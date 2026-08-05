from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.lead import Lead, LeadStatus, LeadSource
from app.models.message import Message, MessageDirection
from app.models.listing import Listing, ListingStatus
from app.models.ml_order import MLOrder
from datetime import date

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    # Google Maps leads
    maps_leads = await db.scalar(
        select(func.count()).select_from(Lead).where(Lead.source == LeadSource.google_maps)
    )
    maps_contacted = await db.scalar(
        select(func.count()).select_from(Lead).where(
            Lead.source == LeadSource.google_maps,
            Lead.status == LeadStatus.contacted,
        )
    )

    # WhatsApp
    messages_today = await db.scalar(
        select(func.count()).select_from(Message).where(
            func.date(Message.created_at) == today,
            Message.direction == MessageDirection.inbound,
        )
    )
    wa_contacts = await db.scalar(
        select(func.count(func.distinct(Message.phone))).select_from(Message).where(
            Message.direction == MessageDirection.inbound,
        )
    )

    # ML listings
    total_listings = await db.scalar(select(func.count()).select_from(Listing))
    pending_opt = await db.scalar(
        select(func.count()).select_from(Listing).where(Listing.status == ListingStatus.pending)
    )

    # ML sales (monthly) + claims — all live from ML API
    total_ventas = 0
    total_orders = 0
    monthly_ventas = 0
    monthly_orders = 0
    reclamos = 0
    reclamos_rate = 0.0
    reclamos_period = "60 días"
    from app.services.ml_service import ml_is_connected, MLService
    if ml_is_connected():
        try:
            svc = MLService()
            monthly = await svc.get_monthly_summary()
            total_ventas   = monthly["total"]
            total_orders   = monthly["count"]
            monthly_ventas = monthly["total"]
            monthly_orders = monthly["count"]
            reclamos = await svc.get_open_claims()
            rep = await svc.get_seller_reputation()
            reclamos_rate = rep.get("claims_rate", 0.0)
            reclamos_period = rep.get("claims_period", "60 días")
        except Exception:
            pass

    return {
        "messages_today":        messages_today or 0,
        "wa_contacts":           wa_contacts or 0,
        "maps_leads":            maps_leads or 0,
        "maps_contacted":        maps_contacted or 0,
        "total_listings":        total_listings or 0,
        "pending_optimizations": pending_opt or 0,
        "total_ventas":          int(total_ventas),
        "total_orders":          total_orders,
        "monthly_ventas":        int(monthly_ventas),
        "monthly_orders":        monthly_orders,
        "reclamos":              reclamos,
        "reclamos_rate":         reclamos_rate,
        "reclamos_period":       reclamos_period,
        # legacy keys
        "total_leads":    maps_leads or 0,
        "contacted_leads": maps_contacted or 0,
        "converted_leads": 0,
    }
