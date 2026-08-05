from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from app.services.portal_service import scrape_portal
from app.config import get_settings

router = APIRouter(prefix="/portal", tags=["portal"])
settings = get_settings()

_sync_status = {"running": False, "last_result": None}


async def _run_sync():
    _sync_status["running"] = True
    try:
        result = await scrape_portal()
        _sync_status["last_result"] = result
    finally:
        _sync_status["running"] = False


@router.post("/sync")
async def sync_portal(background_tasks: BackgroundTasks):
    if _sync_status["running"]:
        return {"message": "Sincronización ya en progreso"}
    background_tasks.add_task(_run_sync)
    return {"message": "Sincronización iniciada"}


@router.get("/sync/status")
def sync_status():
    return _sync_status
