import time
import httpx
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.message import Message
from app.services.kommo_service import KommoService
from app.config import get_settings

router = APIRouter(prefix="/kommo", tags=["kommo"])


@router.post("/webhook")
async def kommo_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    # Log and process Kommo events
    event_type = payload.get("event")
    if event_type == "add" and "leads" in payload:
        for lead_data in payload["leads"].get("add", []):
            pass  # Handle new lead from Kommo
    return {"status": "ok"}


@router.get("/leads")
async def get_kommo_leads():
    svc = KommoService()
    try:
        leads = await svc.get_leads()
        return {"leads": leads, "total": len(leads)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/pipelines")
async def get_pipelines():
    svc = KommoService()
    try:
        return await svc.get_pipelines()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/debug/ml-stages")
async def debug_ml_stages():
    from app.services.kommo_service import PIPELINE_ML
    svc = KommoService()
    try:
        stages = await svc.get_pipeline_stages(PIPELINE_ML)
        return {"pipeline_id": PIPELINE_ML, "stages": stages}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/hot-leads")
async def get_hot_leads(db: AsyncSession = Depends(get_db)):
    """Return top Kommo leads scored by conversion likelihood."""
    import datetime
    settings = get_settings()
    now = int(time.time())
    DAY  = 86400

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.KOMMO_BASE_URL.rstrip('/')}/api/v4/leads",
                headers={"Authorization": f"Bearer {settings.KOMMO_ACCESS_TOKEN}"},
                params={"limit": 50, "order[created_at]": "desc", "with": "contacts,tags"},
                timeout=15,
            )
            resp.raise_for_status()
            leads = resp.json().get("_embedded", {}).get("leads", [])
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    def _norm(p: str) -> str:
        digits = "".join(c for c in str(p) if c.isdigit())
        return digits[-10:] if len(digits) >= 10 else digits

    # Phones with WA activity in last 7 days
    week_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    recent_result = await db.execute(
        select(Message.phone).where(Message.created_at >= week_ago).distinct()
    )
    active_phones_norm = {_norm(row[0]) for row in recent_result}

    scored = []
    for lead in leads:
        score = 5
        tags = [t.get("name", "").lower() for t in lead.get("_embedded", {}).get("tags", [])]

        if "google ads" in tags or "gads" in tags:
            score += 3
        if "autocrm" in tags:
            score += 1

        age = now - (lead.get("created_at") or now)
        if age < DAY:
            score += 3
        elif age < 3 * DAY:
            score += 2
        elif age < 7 * DAY:
            score += 1

        contacts = lead.get("_embedded", {}).get("contacts", [])
        for c in contacts:
            for field in c.get("custom_fields_values") or []:
                for val in field.get("values", []):
                    phone = _norm(val.get("value", ""))
                    if phone and phone in active_phones_norm:
                        score += 1
                        break

        scored.append({
            "id":         lead.get("id"),
            "name":       lead.get("name", ""),
            "score":      min(score, 10),
            "created_at": lead.get("created_at"),
            "tags":       [t.get("name", "") for t in lead.get("_embedded", {}).get("tags", [])],
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:10]


@router.get("/status")
async def kommo_status():
    svc = KommoService()
    try:
        pipelines = await svc.get_pipelines()
        return {"connected": True, "pipelines": len(pipelines)}
    except Exception:
        return {"connected": False}
