"""Storage for the quoting tool served at /cotizador/.

The page is a static app; everything it keeps (settings, margins, imported
supplier price lists, saved quotes, the customer price list) is stored here as
JSON documents. Auth comes from the global JWT middleware in app.main.
"""
import re
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.cotizador_doc import CotizadorDoc

router = APIRouter(prefix="/cotizador", tags=["cotizador"])

COLLECTIONS = {"config", "margenes", "listas", "listaItems", "cotizaciones", "listaPrecios"}
DOC_ID_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,120}$")


def _check(collection: str, doc_id: str | None = None):
    if collection not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Colección desconocida")
    if doc_id is not None and not DOC_ID_RE.match(doc_id):
        raise HTTPException(status_code=400, detail="Identificador inválido")


async def _find(db: AsyncSession, collection: str, doc_id: str) -> CotizadorDoc | None:
    res = await db.execute(
        select(CotizadorDoc).where(CotizadorDoc.collection == collection, CotizadorDoc.doc_id == doc_id)
    )
    return res.scalar_one_or_none()


@router.get("/estado")
async def get_estado(db: AsyncSession = Depends(get_db)):
    """Every document, grouped by collection: {collection: {doc_id: data}}."""
    res = await db.execute(select(CotizadorDoc))
    out: dict[str, dict] = {c: {} for c in COLLECTIONS}
    for doc in res.scalars():
        out.setdefault(doc.collection, {})[doc.doc_id] = doc.data
    return out


@router.put("/docs/{collection}/{doc_id}")
async def set_doc(collection: str, doc_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """Create or replace a document."""
    _check(collection, doc_id)
    doc = await _find(db, collection, doc_id)
    if doc is None:
        db.add(CotizadorDoc(collection=collection, doc_id=doc_id, data=data))
    else:
        doc.data = data
        doc.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.patch("/docs/{collection}/{doc_id}")
async def update_doc(collection: str, doc_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """Merge top-level fields into an existing document."""
    _check(collection, doc_id)
    doc = await _find(db, collection, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="No existe")
    doc.data = {**(doc.data or {}), **data}
    doc.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.delete("/docs/{collection}/{doc_id}")
async def delete_doc(collection: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    _check(collection, doc_id)
    await db.execute(
        delete(CotizadorDoc).where(CotizadorDoc.collection == collection, CotizadorDoc.doc_id == doc_id)
    )
    await db.commit()
    return {"ok": True}
