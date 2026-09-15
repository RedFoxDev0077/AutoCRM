"""Storage for the quoting tool served at /cotizador/.

The page is a static app; everything it keeps (settings, margins, imported
supplier price lists, saved quotes, the customer price list) is stored here as
JSON documents. Auth comes from the global JWT middleware in app.main.
"""
import re
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile
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


# ── supplier price lists that arrive as PDF ─────────────────────────
MAX_PDF_BYTES = 20_000_000
MAX_PDF_PAGES = 80


def _clean_cell(c) -> str:
    # tabs separate columns and a stray inch mark would open a quoted field in the importer
    return " ".join(str(c or "").replace("\t", " ").replace('"', "″").split())


def _pdf_to_text(raw: bytes) -> dict:
    import io
    import pdfplumber

    table_rows: list[list[str]] = []
    text_lines: list[str] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        pages = len(pdf.pages)
        for page in pdf.pages[:MAX_PDF_PAGES]:
            for table in page.extract_tables():
                rows = [[_clean_cell(c) for c in row] for row in table if row]
                rows = [r for r in rows if any(r)]
                if len(rows) >= 2 and max(len(r) for r in rows) >= 2:
                    table_rows += rows
            text_lines += [ln.strip() for ln in (page.extract_text() or "").splitlines() if ln.strip()]

    if len(table_rows) >= 3:
        width = max(len(r) for r in table_rows)
        header = table_rows[0]
        # a table split across pages repeats its header on each page: keep the first one only
        body = [r for i, r in enumerate(table_rows) if i == 0 or r != header]
        # drop columns that are empty in every row
        keep = [j for j in range(width) if any(j < len(r) and r[j] for r in body)]
        lines = ["\t".join(r[j] if j < len(r) else "" for j in keep) for r in body]
        return {"texto": "\n".join(lines), "modo": "tabla", "paginas": pages, "filas": len(lines) - 1}
    if text_lines:
        return {"texto": "\n".join(text_lines), "modo": "lineas", "paginas": pages, "filas": len(text_lines)}
    return {"texto": "", "modo": "vacio", "paginas": pages, "filas": 0}


@router.post("/pdf-texto")
async def pdf_texto(file: UploadFile):
    """Reads a supplier's PDF price list and returns it as text for the importer to map."""
    import asyncio

    raw = await file.read()
    if len(raw) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="El PDF pesa más de 20 MB.")
    if not raw.lstrip().startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF.")
    try:
        out = await asyncio.to_thread(_pdf_to_text, raw)
    except Exception:
        raise HTTPException(status_code=422, detail="No se pudo abrir el PDF. Puede estar dañado o protegido con contraseña.")
    if out["modo"] == "vacio":
        raise HTTPException(status_code=422, detail="El PDF no tiene texto: parece una imagen escaneada. Pedile al proveedor la lista en Excel o en un PDF con texto.")
    return out
