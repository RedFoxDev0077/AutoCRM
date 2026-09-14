"""Mercado Libre report: list runs, run now, download the Excel, import past history."""
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ml_report import MLAdSnapshot, MLReport
from app.services.ml_report import runner
from app.services.ml_report.analysis import next_run
from app.services.ml_report.collector import AR
from app.services.ml_service import ml_is_connected

router = APIRouter(prefix="/ml-report", tags=["ml-report"])


def _out(r: MLReport) -> dict:
    return {
        "id": r.id, "run_date": r.run_date, "trigger": r.trigger, "status": r.status,
        "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
        "finished_at": r.finished_at.isoformat() + "Z" if r.finished_at else None,
        "has_file": bool(r.file_name), "summary": r.summary or {},
    }


@router.get("")
async def list_reports(db: AsyncSession = Depends(get_db)):
    reports = (await db.execute(select(MLReport).order_by(MLReport.created_at.desc()).limit(20))).scalars().all()
    fechas = await db.scalar(select(func.count(distinct(MLAdSnapshot.fecha))))
    return {
        "connected": ml_is_connected(),
        "running": runner.is_running(),
        "next_run": next_run(datetime.now(AR)).isoformat(),
        "history_dates": fechas or 0,
        "reports": [_out(r) for r in reports],
    }


@router.post("/run", status_code=202)
async def run_now():
    if not runner.start_in_background("manual"):
        raise HTTPException(status_code=409, detail="Ya se está generando un informe.")
    return {"started": True}


@router.get("/{report_id}/excel")
async def download_excel(report_id: int, db: AsyncSession = Depends(get_db)):
    rep = await db.get(MLReport, report_id)
    if not rep or not rep.file_name:
        raise HTTPException(status_code=404, detail="Este informe no tiene Excel.")
    path = os.path.join(runner.REPORT_DIR, rep.file_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="El archivo ya no está en el servidor.")
    return FileResponse(path, filename=rep.file_name,
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@router.post("/historial")
async def import_history(file: UploadFile):
    raw = await file.read()
    if len(raw) > 5_000_000:
        raise HTTPException(status_code=413, detail="El archivo es demasiado grande.")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    try:
        return await runner.import_history_csv(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
