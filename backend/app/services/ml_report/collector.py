"""Reads everything the Mercado Libre report needs from the ML API.

Every section is independent: if one endpoint fails (missing permission, API
change, rate limit) the section is recorded in `errors` with the reason and
the rest of the report still runs. Field names are read defensively because
the Ads API has returned slightly different metric keys across versions.
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone

import httpx

from app.services.ml_service import MLService

ML_API = os.environ.get("ML_API_URL", "https://api.mercadolibre.com").rstrip("/")
AR = timezone(timedelta(hours=-3))

# Search terms and the listings to find in each one (from Fede's scheduled task).
TERMINOS = [
    ("pantalon cargo trabajo hombre", ["MLA840065930", "MLA2027015670", "MLA840068870"]),
    ("pantalon de trabajo", ["MLA821671970"]),
    ("camisa de trabajo gabardina", ["MLA824976661"]),
    ("mameluco de trabajo", ["MLA860586514"]),
    ("bermuda cargo trabajo", ["MLA824949342"]),
]

ADS_WINDOW_DAYS = 30
ADS_METRICS = ",".join([
    "clicks", "prints", "cost", "cpc", "acos", "roas", "tacos",
    "direct_amount", "indirect_amount", "total_amount",
    "direct_units_quantity", "indirect_units_quantity", "units_quantity",
])


def _num(*vals):
    for v in vals:
        if v is None or v == "":
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def _day(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


class Collector:
    def __init__(self, svc: MLService | None = None):
        self.svc = svc or MLService()
        self.errors: list[dict] = []
        self.now = datetime.now(AR)

    def _fail(self, section: str, detail: str):
        self.errors.append({"seccion": section, "detalle": detail[:300]})

    async def _get(self, client: httpx.AsyncClient, path: str, params=None, headers=None):
        url = path if path.startswith("http") else f"{ML_API}{path}"
        h = {**self.svc.headers, **(headers or {})}
        resp = await client.get(url, params=params, headers=h, timeout=30)
        if resp.status_code == 401 and await self.svc._refresh_access_token():
            h = {**self.svc.headers, **(headers or {})}
            resp = await client.get(url, params=params, headers=h, timeout=30)
        if resp.status_code == 429:
            await asyncio.sleep(3)
            resp = await client.get(url, params=params, headers=h, timeout=30)
        return resp

    @staticmethod
    def _why(resp: httpx.Response) -> str:
        try:
            body = resp.json()
            msg = body.get("message") or body.get("error") or ""
        except Exception:
            msg = resp.text[:120]
        return f"HTTP {resp.status_code} {msg}".strip()

    # ── catálogo ─────────────────────────────────────────────
    async def listings(self, client) -> dict:
        uid = self.svc.user_id
        out = {"items": {}, "alertas": {}}
        ids, offset = [], 0
        while True:
            r = await self._get(client, f"/users/{uid}/items/search", params={"status": "active", "offset": offset, "limit": 50})
            if r.status_code != 200:
                self._fail("Publicaciones", self._why(r))
                return out
            data = r.json()
            ids += data.get("results", [])
            offset += 50
            if offset >= data.get("paging", {}).get("total", 0) or offset >= 1000:
                break

        # alert counters by listing status
        for key, params in {
            "pausadas": {"status": "paused"},
            "en_revision": {"status": "under_review"},
            "inactivas": {"status": "inactive"},
        }.items():
            r = await self._get(client, f"/users/{uid}/items/search", params={**params, "limit": 1})
            if r.status_code == 200:
                out["alertas"][key] = r.json().get("paging", {}).get("total", 0)

        attrs = "id,title,price,original_price,available_quantity,status,sub_status,health,permalink"
        for i in range(0, len(ids), 20):
            r = await self._get(client, "/items", params={"ids": ",".join(ids[i:i + 20]), "attributes": attrs})
            if r.status_code != 200:
                self._fail("Publicaciones", "detalle: " + self._why(r))
                continue
            for entry in r.json():
                body = entry.get("body") or {}
                if entry.get("code") == 200 and body.get("id"):
                    out["items"][body["id"]] = body

        items = list(out["items"].values())
        out["alertas"]["sin_stock"] = sum(1 for it in items if (it.get("available_quantity") or 0) <= 0)
        out["alertas"]["stock_bajo"] = sum(1 for it in items if 0 < (it.get("available_quantity") or 0) < 20)
        out["alertas"]["para_corregir"] = sum(1 for it in items if any("waiting_for_patch" in s or "picture" in s for s in (it.get("sub_status") or [])))
        out["alertas"]["calidad_baja"] = sum(1 for it in items if it.get("health") is not None and float(it["health"]) < 0.7)
        return out

    async def visits(self, client, ids: list[str], days_back_from: int, days: int) -> dict:
        """Visits per listing for the `days` days ending `days_back_from` days ago."""
        end = self.now - timedelta(days=days_back_from)
        start = end - timedelta(days=days)
        res: dict[str, float] = {}
        for i in range(0, len(ids), 50):
            r = await self._get(client, "/items/visits", params={
                "ids": ",".join(ids[i:i + 50]),
                "date_from": start.strftime("%Y-%m-%dT00:00:00.000-03:00"),
                "date_to": end.strftime("%Y-%m-%dT23:59:59.999-03:00"),
            })
            if r.status_code != 200:
                self._fail("Visitas", self._why(r))
                return res
            data = r.json()
            rows = data if isinstance(data, list) else [{"item_id": k, "total_visits": v} for k, v in data.items()] if isinstance(data, dict) else []
            for row in rows:
                if isinstance(row, dict) and row.get("item_id"):
                    res[row["item_id"]] = _num(row.get("total_visits"), row.get("visits")) or 0
        return res

    async def orders(self, client, days_back_from: int, days: int) -> dict:
        """Units and amount per listing, plus total sales amount, for a window of paid orders."""
        end = self.now - timedelta(days=days_back_from)
        start = end - timedelta(days=days)
        units: dict[str, float] = {}
        total, offset = 0.0, 0
        while True:
            r = await self._get(client, "/orders/search", params={
                "seller": self.svc.user_id, "order.status": "paid",
                "order.date_created.from": start.strftime("%Y-%m-%dT00:00:00.000-03:00"),
                "order.date_created.to": end.strftime("%Y-%m-%dT23:59:59.999-03:00"),
                "limit": 50, "offset": offset,
            })
            if r.status_code != 200:
                self._fail("Ventas", self._why(r))
                break
            data = r.json()
            for o in data.get("results", []):
                total += _num(o.get("total_amount")) or 0
                for oi in o.get("order_items", []):
                    iid = (oi.get("item") or {}).get("id")
                    if iid:
                        units[iid] = units.get(iid, 0) + (_num(oi.get("quantity")) or 0)
            offset += 50
            if offset >= data.get("paging", {}).get("total", 0) or offset >= 5000:
                break
        return {"units": units, "total": total}

    # ── publicidad ───────────────────────────────────────────
    async def ads(self, client) -> dict:
        out = {"advertiser": None, "campaigns": [], "ads": [], "desde": None, "hasta": None}
        r = await self._get(client, "/advertising/advertisers", params={"product_id": "PADS"}, headers={"Api-Version": "1"})
        if r.status_code != 200:
            self._fail("Mercado Ads", "anunciante: " + self._why(r))
            return out
        advs = r.json().get("advertisers", [])
        if not advs:
            self._fail("Mercado Ads", "la cuenta no tiene anunciante de Product Ads")
            return out
        adv = advs[0]
        adv_id, site = adv.get("advertiser_id"), adv.get("site_id", "MLA")
        out["advertiser"] = adv_id
        desde, hasta = _day(self.now - timedelta(days=ADS_WINDOW_DAYS)), _day(self.now)
        out["desde"], out["hasta"] = desde, hasta
        common = {"date_from": desde, "date_to": hasta, "metrics": ADS_METRICS, "limit": 50}
        hv2 = {"api-version": "2"}

        for kind in ("campaigns", "ads"):
            offset = 0
            while True:
                r = await self._get(client, f"/advertising/{site}/advertisers/{adv_id}/product_ads/{kind}/search",
                                    params={**common, "offset": offset}, headers=hv2)
                if r.status_code != 200:
                    self._fail("Mercado Ads", f"{'campañas' if kind == 'campaigns' else 'anuncios'}: " + self._why(r))
                    break
                data = r.json()
                page = data.get("results", [])
                out[kind] += page
                offset += 50
                if not page or offset >= data.get("paging", {}).get("total", 0):
                    break
        return out

    # ── promociones ──────────────────────────────────────────
    async def promotions(self, client) -> list[dict]:
        r = await self._get(client, f"/seller-promotions/users/{self.svc.user_id}", params={"app_version": "v2"})
        if r.status_code != 200:
            self._fail("Promociones", self._why(r))
            return []
        return r.json().get("results", [])

    # ── posiciones ───────────────────────────────────────────
    async def positions(self, client) -> list[dict]:
        rows = []
        for termino, mlas in TERMINOS:
            r = await self._get(client, "/sites/MLA/search", params={"q": termino, "limit": 50})
            if r.status_code != 200:
                self._fail("Posiciones", f"«{termino}»: " + self._why(r))
                rows.append({"termino": termino, "total": None, "mlas": mlas, "resultados": None})
                continue
            data = r.json()
            rows.append({"termino": termino, "total": data.get("paging", {}).get("total"), "mlas": mlas,
                         "resultados": [{"id": x.get("id"), "title": x.get("title", ""), "price": x.get("price")} for x in data.get("results", [])]})
            await asyncio.sleep(0.4)
        return rows

    async def collect(self) -> dict:
        async with httpx.AsyncClient() as client:
            cat = await self.listings(client)
            ids = list(cat["items"].keys())
            vis_now = await self.visits(client, ids, 0, 7) if ids else {}
            vis_prev = await self.visits(client, ids, 7, 7) if ids else {}
            ord_now = await self.orders(client, 0, 7)
            ord_prev = await self.orders(client, 7, 7)
            ord_30 = await self.orders(client, 0, ADS_WINDOW_DAYS)
            ads = await self.ads(client)
            promos = await self.promotions(client)
            pos = await self.positions(client)
        return {
            "fecha": _day(self.now), "catalogo": cat,
            "visitas": vis_now, "visitas_prev": vis_prev,
            "ventas": ord_now["units"], "ventas_prev": ord_prev["units"],
            "facturacion_30d": ord_30["total"],
            "ads": ads, "promociones": promos, "posiciones": pos,
        }
