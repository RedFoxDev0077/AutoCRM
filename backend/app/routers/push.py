from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.services.push_service import send_push_to_all

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.post("/subscribe")
async def subscribe(body: SubscribeBody, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    )
    if existing:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
    else:
        db.add(PushSubscription(endpoint=body.endpoint, p256dh=body.p256dh, auth=body.auth))
    await db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
async def unsubscribe(body: SubscribeBody, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    )
    await db.commit()
    return {"status": "unsubscribed"}


@router.post("/test")
async def test_push(db: AsyncSession = Depends(get_db)):
    sent = await send_push_to_all(db, "AutoCRM — Prueba", "Las notificaciones push están funcionando correctamente", "/mercadolibre")
    return {"sent": sent}
