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


_HEADER_RX = re.compile(r"(descrip|producto|art[ií]culo|detalle|precio|costo|c[oó]digo|bulto|talle|color|cantidad)", re.I)
_PRICE_COL_RX = re.compile(r"(precio|costo|importe|valor)", re.I)
_DESC_COL_RX = re.compile(r"(descrip|producto|art[ií]culo|detalle)", re.I)


def _is_header(row: list[str]) -> bool:
    # header cells are short labels without numbers ("Precio", "Código"), unlike product
    # rows that happen to say "NUEVO PRODUCTO 11,00 USS" or "Talle M al XL"
    return sum(1 for c in row if c and len(c) <= 25 and not re.search(r"\d", c) and _HEADER_RX.search(c)) >= 2


_PRICE_CELL_RX = re.compile(r"\d[\d.]*,\d{2}\b|\d[\d,]*\.\d{2}\b|\$\s*\d|\d\s*(u\$?s{1,2}|usd)\b", re.I)


def _shift_names(names: list[str], rows: list[list[str]]) -> list[str] | None:
    """Header-less table with fewer columns than the previous header: line the columns
    up by where the prices are, e.g. the first (empty) column missing on that page."""
    pcol = next((j for j, n in enumerate(names) if _PRICE_COL_RX.search(n)), None)
    width = len(rows[0])
    if pcol is None or width >= len(names):
        return None
    hits = [sum(1 for r in rows if _PRICE_CELL_RX.search(r[j])) for j in range(width)]
    if max(hits) < max(1, len(rows) // 2):
        return None
    offset = pcol - hits.index(max(hits))
    if offset < 0 or offset + width > len(names):
        return None
    return names[offset:offset + width]


def _tables_to_records(tables: list[list[list[str]]]) -> tuple[list[str], list[dict]]:
    """Each table is read with its own header, so a page whose table has a different
    column layout still lines up with the others. Header-less tables reuse the last
    header when they have the same width (a table continued on the next page)."""
    order: list[str] = []
    records: list[dict] = []
    last_names: list[str] | None = None
    for rows in tables:
        width = max(len(r) for r in rows)
        rows = [r + [""] * (width - len(r)) for r in rows]
        keep = [j for j in range(width) if any(r[j] for r in rows)]
        rows = [[r[j] for j in keep] for r in rows]
        if not rows or not rows[0]:
            continue
        h = next((i for i, r in enumerate(rows) if _is_header(r)), None)
        if h is not None:
            names = [c or f"Columna {j + 1}" for j, c in enumerate(rows[h])]
            last_names, body = names, rows[:h] + rows[h + 1:]
        elif last_names and len(last_names) == len(rows[0]):
            names, body = last_names, rows
        elif last_names and (shifted := _shift_names(last_names, rows)):
            names, body = shifted, rows
        else:
            names, body = [f"Columna {j + 1}" for j in range(len(rows[0]))], rows
        for n in names:
            if n not in order:
                order.append(n)
        records += [{names[j]: r[j] for j in range(len(names)) if r[j]} for r in body]
    return order, [r for r in records if r]


def _join_split_rows(order: list[str], records: list[dict]) -> list[dict]:
    """A product whose description wraps onto a row that has no price is joined to the
    next priced row (e.g. "Válvula de Exhalación DUTY Para" + "Semimáscara TPR ... 0,85 USS")."""
    pcol = next((n for n in order if _PRICE_COL_RX.search(n)), None)
    dcol = next((n for n in order if _DESC_COL_RX.search(n)), None)
    if not pcol or not dcol:
        return records
    out, pending = [], None
    for r in records:
        priced = bool(re.search(r"\d", r.get(pcol, "")))
        if r.get(dcol) and not priced:
            if pending:
                out.append(pending)
            pending = r
            continue
        if pending and priced and r.get(dcol):
            joined = {**pending, **{k: v for k, v in r.items() if v}}
            joined[dcol] = f"{pending[dcol]} {r[dcol]}".strip()
            out.append(joined)
            pending = None
            continue
        if pending:
            out.append(pending)
            pending = None
        out.append(r)
    if pending:
        out.append(pending)
    return out


def _pdf_to_text(raw: bytes) -> dict:
    import io
    import pdfplumber

    tables: list[list[list[str]]] = []
    text_lines: list[str] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        pages = len(pdf.pages)
        for page in pdf.pages[:MAX_PDF_PAGES]:
            for table in page.extract_tables():
                rows = [[_clean_cell(c) for c in row] for row in table if row]
                rows = [r for r in rows if any(r)]
                if len(rows) >= 2 and max(len(r) for r in rows) >= 2:
                    tables.append(rows)
            text_lines += [ln.strip() for ln in (page.extract_text() or "").splitlines() if ln.strip()]

    if sum(len(t) for t in tables) >= 3:
        order, records = _tables_to_records(tables)
        records = _join_split_rows(order, records)
        lines = ["\t".join(order)] + ["\t".join(r.get(n, "") for n in order) for r in records]
        return {"texto": "\n".join(lines), "modo": "tabla", "paginas": pages, "filas": len(records)}
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
