"""Runs the Mercado Libre report end to end and schedules it for Monday and Thursday."""
import asyncio
import csv
import io
import os
from datetime import datetime

from sqlalchemy import delete, func, select

from app.database import AsyncSessionLocal
from app.models.ml_report import MLAdSnapshot, MLPositionSnapshot, MLReport
from app.services.ml_service import ml_is_connected

from . import analysis as A
from .collector import AR, Collector
from .excel import build_workbook

REPORT_DIR = os.environ.get("ML_REPORT_DIR", "/app/data/ml_reports")
RUN_HOUR = 8
AD_FIELDS = ["fecha", "mla", "titulo", "campana", "estado", "impresiones", "clics", "cpc", "ventas_atrib", "ingresos",
             "inversion", "acos", "tacos", "roas", "visitas_7d", "ventas_7d", "conversion_7d", "precio_lista",
             "precio_final", "stock", "calidad"]
POS_FIELDS = ["fecha", "termino", "total_resultados", "mla", "titulo", "posicion"]

_lock = asyncio.Lock()
_tasks: set[asyncio.Task] = set()


def is_running() -> bool:
    return _lock.locked()


def start_in_background(trigger: str) -> bool:
    if _lock.locked():
        return False
    task = asyncio.create_task(run_report(trigger))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return True


def _as_dict(obj, fields):
    return {f: getattr(obj, f) for f in fields}


async def run_report(trigger: str = "manual", collector: Collector | None = None) -> int | None:
    if _lock.locked():
        return None
    async with _lock, AsyncSessionLocal() as db:
        fecha = datetime.now(AR).strftime("%Y-%m-%d")
        rep = MLReport(run_date=fecha, trigger=trigger, status="running", summary={})
        db.add(rep)
        await db.commit()
        await db.refresh(rep)
        try:
            if collector is None and not ml_is_connected():
                raise RuntimeError("Mercado Libre no está conectado. Conectalo desde el panel (Mercado Libre → Conectar).")
            col = collector or Collector()
            data = await col.collect()
            fecha = data["fecha"]
            rows, pos = A.snapshot_rows(data), A.position_rows(data)

            # today's rows replace any earlier run of the same day
            await db.execute(delete(MLAdSnapshot).where(MLAdSnapshot.fecha == fecha))
            await db.execute(delete(MLPositionSnapshot).where(MLPositionSnapshot.fecha == fecha))
            db.add_all(MLAdSnapshot(**r) for r in rows)
            db.add_all(MLPositionSnapshot(**p) for p in pos)
            await db.commit()

            hist = [_as_dict(x, AD_FIELDS) for x in (await db.execute(
                select(MLAdSnapshot).order_by(MLAdSnapshot.fecha, MLAdSnapshot.mla))).scalars()]
            all_pos = [_as_dict(x, POS_FIELDS) for x in (await db.execute(
                select(MLPositionSnapshot).order_by(MLPositionSnapshot.fecha, MLPositionSnapshot.id))).scalars()]
            prev_ad_date = A.previous_date([h["fecha"] for h in hist], fecha)
            prev_rows = [h for h in hist if h["fecha"] == prev_ad_date]
            prev_pos = [p for p in all_pos if p["fecha"] < fecha]  # oldest first: later rows win

            fact = data["facturacion_30d"]
            campaigns = A.campaign_rows(data, fact)
            metrics = A.account_metrics(rows, fact)
            prev_rep = (await db.execute(
                select(MLReport).where(MLReport.id != rep.id, MLReport.status.in_(["ok", "parcial"]))
                .order_by(MLReport.created_at.desc()).limit(1))).scalar_one_or_none()
            prev_metrics = (prev_rep.summary or {}).get("metricas") if prev_rep else None
            if prev_metrics is None and prev_rows:
                prev_metrics = A.account_metrics(prev_rows, 0)

            actions = A.find_actions(rows, prev_rows, pos, prev_pos, campaigns, data["promociones"], fecha)
            highlights = A.highlights(metrics, prev_metrics, actions, col.errors)

            os.makedirs(REPORT_DIR, exist_ok=True)
            file_name = f"ML_informe_{fecha}.xlsx"
            build_workbook(
                os.path.join(REPORT_DIR, file_name), fecha=fecha, metrics=metrics,
                alertas=data["catalogo"]["alertas"], highlights=highlights, history=hist, positions=all_pos,
                campaigns=campaigns, competidores=A.competidores(data), promos=data["promociones"],
                actions=actions, errors=col.errors, ads_desde=data["ads"]["desde"], ads_hasta=data["ads"]["hasta"],
            )
            nothing = not rows and not data["catalogo"]["items"]
            rep.status = "error" if nothing and col.errors else ("parcial" if col.errors else "ok")
            rep.file_name = file_name
            rep.summary = {
                "metricas": metrics, "alertas": data["catalogo"]["alertas"], "destacados": highlights,
                "acciones": actions, "errores": col.errors, "anuncios": len(rows),
                "posiciones": pos, "campanas": [{"nombre": c["nombre"], "estado": c["estado"], "roas": c["roas"],
                                                 "inversion": c["inversion"], "presupuesto": c["presupuesto"]} for c in campaigns],
                "comparado_con": prev_ad_date,
            }
        except Exception as exc:  # the report page shows this instead of a silent failure
            rep.status = "error"
            rep.summary = {"destacados": [f"No se pudo generar el informe: {exc}"],
                           "errores": [{"seccion": "Informe", "detalle": str(exc)[:300]}]}
        rep.finished_at = datetime.utcnow()
        await db.commit()

        try:
            from app.services.push_service import send_push_to_all
            titulo = "Informe de Mercado Libre listo" if rep.status != "error" else "No se pudo generar el informe de ML"
            await send_push_to_all(db, titulo, (rep.summary.get("destacados") or [""])[0][:140], "/informe-ml")
        except Exception as exc:
            print(f"[ml_report] push: {exc}")
        return rep.id


async def scheduler_loop():
    """Every 10 minutes: on Monday or Thursday after 08:00 (AR), run once if today's report is missing."""
    while True:
        await asyncio.sleep(600)
        try:
            now = datetime.now(AR)
            if now.weekday() not in (0, 3) or now.hour < RUN_HOUR or not ml_is_connected() or is_running():
                continue
            hoy = now.strftime("%Y-%m-%d")
            async with AsyncSessionLocal() as db:
                done = await db.scalar(select(func.count()).select_from(MLReport).where(
                    MLReport.run_date == hoy, MLReport.trigger == "programado", MLReport.status != "error"))
                tries = await db.scalar(select(func.count()).select_from(MLReport).where(
                    MLReport.run_date == hoy, MLReport.trigger == "programado"))
            if not done and tries < 3:
                await run_report("programado")
        except Exception as exc:
            print(f"[ml_report] scheduler: {exc}")


# ── import of the CSVs Fede accumulated in Google Drive ─────────────
_HIST_MAP = {
    "Fecha": "fecha", "MLA": "mla", "Titulo": "titulo", "Campana": "campana", "Estado anuncio": "estado",
    "Impresiones": "impresiones", "Clics": "clics", "CPC": "cpc", "Ventas atrib": "ventas_atrib",
    "Ingresos pub": "ingresos", "Inversion": "inversion", "ACOS pct": "acos", "TACOS pct": "tacos", "ROAS": "roas",
    "Visitas 7d": "visitas_7d", "Ventas 7d": "ventas_7d", "Conversion 7d pct": "conversion_7d",
    "Precio lista": "precio_lista", "Precio final": "precio_final", "Stock": "stock", "Calidad": "calidad",
}
_POS_MAP = {"Fecha": "fecha", "Termino": "termino", "Total resultados": "total_resultados", "MLA": "mla",
            "Titulo": "titulo", "Posicion": "posicion"}
_TEXT = {"fecha", "mla", "titulo", "campana", "estado", "termino", "posicion"}


def _cell(key, val):
    val = (val or "").strip()
    if key in _TEXT:
        return val
    if val == "":
        return None
    try:
        n = float(val.replace(",", ""))
        return int(n) if key == "total_resultados" else n
    except ValueError:
        return None


async def import_history_csv(text: str) -> dict:
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    if "Termino" in headers and "Posicion" in headers:
        tipo, mapping, model = "posiciones", _POS_MAP, MLPositionSnapshot
    elif "Inversion" in headers and "MLA" in headers:
        tipo, mapping, model = "historico", _HIST_MAP, MLAdSnapshot
    else:
        raise ValueError("No reconozco el archivo: tiene que ser «Historico ML - acumulado» o «Posiciones ML - acumulado».")

    async with AsyncSessionLocal() as db:
        if tipo == "historico":
            existing = {(x.fecha, x.mla) for x in (await db.execute(select(MLAdSnapshot))).scalars()}
        else:
            existing = {(x.fecha, x.termino, x.mla) for x in (await db.execute(select(MLPositionSnapshot))).scalars()}
        added = skipped = 0
        for raw in reader:
            row = {mapping[k.strip()]: _cell(mapping[k.strip()], v) for k, v in raw.items() if k and k.strip() in mapping}
            if not row.get("fecha") or not row.get("mla"):
                skipped += 1
                continue
            if tipo == "posiciones" and row.get("posicion", "").isdigit() is False and row.get("posicion") not in ("no aparece", "no medido"):
                row["posicion"] = row.get("posicion") or "no medido"
            key = (row["fecha"], row["mla"]) if tipo == "historico" else (row["fecha"], row["termino"], row["mla"])
            if key in existing:
                skipped += 1
                continue
            existing.add(key)
            db.add(model(**row))
            added += 1
        await db.commit()
    return {"tipo": tipo, "importadas": added, "omitidas": skipped}
