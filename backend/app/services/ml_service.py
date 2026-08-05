import re
import httpx
import json
from pathlib import Path
from app.config import get_settings

ML_ID_RE = re.compile(r'\b(ML[A-Z]\d+)\b', re.IGNORECASE)

settings = get_settings()
ML_API = "https://api.mercadolibre.com"
ML_TOKEN_FILE = Path("/app/data/ml_tokens.json")


def _load_tokens() -> dict:
    if ML_TOKEN_FILE.exists():
        try:
            return json.loads(ML_TOKEN_FILE.read_text())
        except Exception:
            pass
    return {
        "access_token": settings.ML_ACCESS_TOKEN,
        "user_id": settings.ML_USER_ID,
    }


def _save_tokens(tokens: dict):
    ML_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    ML_TOKEN_FILE.write_text(json.dumps(tokens))


def ml_is_connected() -> bool:
    tokens = _load_tokens()
    return bool(tokens.get("access_token")) and bool(tokens.get("user_id"))


class MLService:
    def __init__(self):
        tokens = _load_tokens()
        self.token = tokens.get("access_token", "")
        self.refresh_token = tokens.get("refresh_token", "")
        self.user_id = str(tokens.get("user_id", ""))
        self.headers = {"Authorization": f"Bearer {self.token}"}

    async def _refresh_access_token(self) -> bool:
        if not self.refresh_token:
            return False
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.mercadolibre.com/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": settings.ML_APP_ID,
                    "client_secret": settings.ML_APP_SECRET,
                    "refresh_token": self.refresh_token,
                },
                timeout=15,
            )
            data = resp.json()
        if "access_token" not in data:
            return False
        self.token = data["access_token"]
        self.refresh_token = data.get("refresh_token", self.refresh_token)
        self.headers = {"Authorization": f"Bearer {self.token}"}
        _save_tokens({
            "access_token": self.token,
            "refresh_token": self.refresh_token,
            "user_id": self.user_id,
        })
        return True

    async def get_user_listings(self) -> list[str]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API}/users/{self.user_id}/items/search",
                headers=self.headers,
                params={"limit": 50, "status": "active"},
                timeout=20,
            )
            if resp.status_code == 401 and await self._refresh_access_token():
                resp = await client.get(
                    f"{ML_API}/users/{self.user_id}/items/search",
                    headers=self.headers,
                    params={"limit": 50, "status": "active"},
                    timeout=20,
                )
            resp.raise_for_status()
            return resp.json().get("results", [])

    async def get_listing_detail(self, item_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API}/items/{item_id}",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_listing_description(self, item_id: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API}/items/{item_id}/description",
                headers=self.headers,
                timeout=15,
            )
            if resp.status_code == 200:
                return resp.json().get("plain_text", "")
            return ""

    async def _authed_put(self, client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
        resp = await client.put(url, headers=self.headers, **kwargs)
        if resp.status_code == 401 and await self._refresh_access_token():
            resp = await client.put(url, headers=self.headers, **kwargs)
        return resp

    async def update_listing(self, item_id: str, title: str, price: float = None, quantity: int = None) -> dict:
        payload: dict = {"title": title}
        if price is not None:
            payload["price"] = price
        if quantity is not None:
            payload["available_quantity"] = quantity
        async with httpx.AsyncClient() as client:
            resp = await self._authed_put(
                client, f"{ML_API}/items/{item_id}",
                json=payload, timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def update_description(self, item_id: str, description: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await self._authed_put(
                client, f"{ML_API}/items/{item_id}/description",
                json={"plain_text": description}, timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def _authed_get(self, client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
        resp = await client.get(url, headers=self.headers, **kwargs)
        if resp.status_code == 401 and await self._refresh_access_token():
            resp = await client.get(url, headers=self.headers, **kwargs)
        return resp

    async def _authed_post(self, client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
        resp = await client.post(url, headers=self.headers, **kwargs)
        if resp.status_code == 401 and await self._refresh_access_token():
            resp = await client.post(url, headers=self.headers, **kwargs)
        return resp

    async def get_items_batch(self, item_ids: list) -> dict:
        if not item_ids:
            return {}
        async with httpx.AsyncClient() as client:
            resp = await self._authed_get(
                client, f"{ML_API}/items",
                params={"ids": ",".join(item_ids)}, timeout=20,
            )
            if resp.status_code != 200:
                return {}
            result = {}
            for entry in resp.json():
                if entry.get("code") == 200:
                    body = entry.get("body", {})
                    # Build variant stock breakdown
                    variations = []
                    for v in body.get("variations", []):
                        combos = v.get("attribute_combinations", [])
                        label = " / ".join(
                            a.get("value_name", "") for a in combos if a.get("value_name")
                        )
                        if label:
                            variations.append({
                                "label": label,
                                "stock": v.get("available_quantity", 0),
                            })
                    parent_qty = body.get("available_quantity") or 0
                    if parent_qty == 0 and variations:
                        parent_qty = sum(v["stock"] for v in variations)
                    result[body.get("id", "")] = {
                        "title": body.get("title", ""),
                        "available_quantity": parent_qty,
                        "thumbnail": body.get("thumbnail", ""),
                        "permalink": body.get("permalink", ""),
                        "variations": variations,
                    }
            return result

    async def get_received_questions(self, status: str = "UNANSWERED") -> list[dict]:
        async with httpx.AsyncClient() as client:
            resp = await self._authed_get(
                client, f"{ML_API}/questions/search",
                params={"seller_id": self.user_id, "status": status, "limit": 50}, timeout=20,
            )
            resp.raise_for_status()
            questions = resp.json().get("questions", [])

        # Enrich with item title + stock
        item_ids = list({q["item_id"] for q in questions if q.get("item_id")})
        items = await self.get_items_batch(item_ids)
        for q in questions:
            iid = q.get("item_id", "")
            if iid in items:
                q["item"] = items[iid]
        return questions

    async def answer_question(self, question_id: int, text: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await self._authed_post(
                client, f"{ML_API}/answers",
                json={"question_id": question_id, "text": text}, timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_item_public(self, item_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ML_API}/items/{item_id}", timeout=15)
            return resp.json() if resp.status_code == 200 else {}

    async def predict_category(self, title: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API}/sites/MLA/domain_discovery/search",
                params={"limit": 1, "q": title}, timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    return data[0].get("category_id", "")
        return ""

    async def get_seller_reputation(self) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await self._authed_get(client, f"{ML_API}/users/{self.user_id}", timeout=15)
            if resp.status_code != 200:
                return {}
            data = resp.json()
            metrics = data.get("seller_reputation", {}).get("metrics", {})
            claims = metrics.get("claims", {})
            return {
                "claims_rate": round(claims.get("rate", 0) * 100, 2),
                "claims_count": claims.get("value", 0),
                "claims_period": claims.get("period", "60 días"),
            }

    async def get_open_claims(self) -> int:
        async with httpx.AsyncClient() as client:
            resp = await self._authed_get(
                client, f"{ML_API}/claims/search",
                params={"seller_id": self.user_id, "status": "opened", "resource": "order", "limit": 1},
                timeout=15,
            )
            if resp.status_code != 200:
                return 0
            return resp.json().get("paging", {}).get("total", 0)

    async def create_listing(self, data: dict) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await self._authed_post(
                client, f"{ML_API}/items",
                json=data, timeout=20,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_monthly_summary(self) -> dict:
        from datetime import datetime, timezone, timedelta
        ar_tz = timezone(timedelta(hours=-3))
        now = datetime.now(ar_tz)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        month_end   = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()

        all_results: list = []
        offset = 0
        limit = 50
        async with httpx.AsyncClient() as client:
            while True:
                resp = await self._authed_get(
                    client, f"{ML_API}/orders/search",
                    params={
                        "seller": self.user_id,
                        "order.status": "paid",
                        "order.date_created.from": month_start,
                        "order.date_created.to":   month_end,
                        "limit": limit,
                        "offset": offset,
                    },
                    timeout=20,
                )
                if resp.status_code != 200:
                    break
                data = resp.json()
                page = data.get("results", [])
                all_results.extend(page)
                total_count = data.get("paging", {}).get("total", 0)
                if offset + limit >= total_count or not page:
                    break
                offset += limit

        total = sum(o.get("total_amount", 0) for o in all_results)
        return {"count": len(all_results), "total": int(total)}

    async def get_daily_sales(self) -> dict:
        from datetime import datetime, timezone, timedelta
        ar_tz = timezone(timedelta(hours=-3))
        now = datetime.now(ar_tz)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end   = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()

        all_results: list = []
        offset = 0
        limit = 50
        async with httpx.AsyncClient() as client:
            while True:
                resp = await self._authed_get(
                    client, f"{ML_API}/orders/search",
                    params={
                        "seller": self.user_id,
                        "order.status": "paid",
                        "order.date_created.from": day_start,
                        "order.date_created.to":   day_end,
                        "limit": limit,
                        "offset": offset,
                    },
                    timeout=20,
                )
                if resp.status_code != 200:
                    break
                data = resp.json()
                page = data.get("results", [])
                all_results.extend(page)
                total_count = data.get("paging", {}).get("total", 0)
                if offset + limit >= total_count or not page:
                    break
                offset += limit

        total = sum(o.get("total_amount", 0) for o in all_results)
        orders = []
        for o in all_results:
            items = o.get("order_items", [])
            first = items[0] if items else {}
            orders.append({
                "id": o.get("id"),
                "date": o.get("date_created", ""),
                "total": o.get("total_amount", 0),
                "quantity": sum(i.get("quantity", 1) for i in items),
                "title": first.get("item", {}).get("title", "—"),
                "item_id": first.get("item", {}).get("id", ""),
                "extra_items": len(items) - 1 if len(items) > 1 else 0,
            })
        return {
            "count": len(all_results),
            "total": total,
            "currency": "ARS",
            "orders": orders,
        }
