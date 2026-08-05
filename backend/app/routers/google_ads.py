import httpx
from fastapi import APIRouter, Request, Query
from typing import Optional
from app.config import get_settings
from app.services.kommo_service import KommoService, PIPELINE_VENTAS, STATUS_LEADS_ENTRANTES

router = APIRouter(prefix="/google-ads", tags=["google-ads"])


@router.get("/leads")
async def get_google_ads_leads(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    """Fetch leads tagged 'Google Ads' from Kommo, optionally filtered by date range."""
    import datetime
    settings = get_settings()

    ts_from: Optional[int] = None
    ts_to: Optional[int] = None
    if date_from:
        ts_from = int(datetime.datetime.strptime(date_from, "%Y-%m-%d").timestamp())
    if date_to:
        ts_to = int((datetime.datetime.strptime(date_to, "%Y-%m-%d") + datetime.timedelta(days=1)).timestamp())

    all_leads: dict[int, dict] = {}

    async def _fetch(params: dict) -> list:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.KOMMO_BASE_URL.rstrip('/')}/api/v4/leads",
                headers={"Authorization": f"Bearer {settings.KOMMO_ACCESS_TOKEN}"},
                params=params,
                timeout=15,
            )
            if resp.status_code == 204:
                return []
            resp.raise_for_status()
            return resp.json().get("_embedded", {}).get("leads", [])

    date_filter: dict = {}
    if ts_from:
        date_filter["filter[created_at][from]"] = ts_from
    if ts_to:
        date_filter["filter[created_at][to]"] = ts_to

    try:
        # Search 1: by tag "Google Ads" (catches WhatsApp-triggered leads)
        for l in await _fetch({"filter[tags][0]": "Google Ads", "limit": 200, **date_filter}):
            all_leads[l["id"]] = l
    except Exception:
        pass

    try:
        # Search 2: by name prefix "GAds" (catches Google Lead Form webhook leads)
        for l in await _fetch({"query": "GAds", "limit": 200, **date_filter}):
            all_leads[l["id"]] = l
    except Exception:
        pass

    return [
        {
            "id": l.get("id"),
            "name": l.get("name", ""),
            "created_at": l.get("created_at"),
            "pipeline_id": l.get("pipeline_id"),
            "status_id": l.get("status_id"),
        }
        for l in sorted(all_leads.values(), key=lambda x: x.get("created_at") or 0, reverse=True)
    ]


GADS_TRIGGER = "me contacto desde este sitio web"
GADS_MESSAGE = "Hola, me contacto desde este sitio web"


@router.get("/wa-link")
async def get_wa_link():
    settings = get_settings()
    phone = settings.WA_BUSINESS_PHONE.strip()
    if not phone:
        return {"url": None, "message": GADS_MESSAGE, "trigger": GADS_TRIGGER}
    import urllib.parse
    url = f"https://wa.me/{phone}?text={urllib.parse.quote(GADS_MESSAGE)}"
    return {"url": url, "message": GADS_MESSAGE, "trigger": GADS_TRIGGER, "phone": phone}


@router.get("/webhook-url")
async def get_webhook_url():
    return {"url": "https://panel.indumentariasegura.com.ar/api/google-ads/webhook"}


@router.post("/webhook")
async def google_ads_lead_webhook(request: Request):
    """Receives lead form submissions from Google Ads Lead Form Assets."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    columns = body.get("user_column_data", [])
    data = {
        item.get("column_name", "").lower().replace(" ", "_"): item.get("string_value", "")
        for item in columns
    }

    name = data.get("full_name") or data.get("name") or "Lead Google Ads"
    phone = data.get("phone_number") or data.get("phone") or ""
    email = data.get("email") or ""
    campaign = body.get("campaign_name", "")
    ad_group = body.get("ad_group_name", "")

    settings = get_settings()
    lead_name = f"GAds - {name}" + (f" | {phone}" if phone else "")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.KOMMO_BASE_URL.rstrip('/')}/api/v4/leads",
                headers={
                    "Authorization": f"Bearer {settings.KOMMO_ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                },
                json=[{
                    "name": lead_name,
                    "pipeline_id": PIPELINE_VENTAS,
                    "status_id": STATUS_LEADS_ENTRANTES,
                    "tags": [{"name": "Google Ads"}, {"name": "AutoCRM"}],
                }],
                timeout=15,
            )
            resp.raise_for_status()
            leads = resp.json().get("_embedded", {}).get("leads", [])
            lead = leads[0] if leads else {}
            if lead.get("id"):
                kommo = KommoService()
                parts = ["Lead de Google Ads"]
                if phone:    parts.append(f"Teléfono: {phone}")
                if email:    parts.append(f"Email: {email}")
                if campaign: parts.append(f"Campaña: {campaign}")
                if ad_group: parts.append(f"Grupo de anuncios: {ad_group}")
                await kommo.add_note(lead["id"], "\n".join(parts))
                await kommo.add_task(lead["id"], f"Nuevo lead Google Ads: {name} — contactar en 1hs", due_hours=1)
    except Exception as e:
        print(f"[google_ads] kommo error: {e}")

    return {"status": "received"}
