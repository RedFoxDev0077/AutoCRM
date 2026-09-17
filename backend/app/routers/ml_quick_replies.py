"""Saved answers for Mercado Libre questions ("respuestas guardadas")."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ml_quick_reply import MLQuickReply

router = APIRouter(prefix="/ml/respuestas", tags=["ml-respuestas"])

# ML rejects answers over 2000 characters
MAX_TEXTO = 2000

# Starting set so the feature is useful on day one; Fede edits or deletes them.
INICIALES = [
    ("Stock", "Hola, ¿cómo estás? Sí, tenemos stock disponible de {producto}. Podés ofertar sin problema. ¡Saludos!"),
    ("Talles", "Hola, ¿cómo estás? Los talles disponibles son los que figuran en la publicación. Si necesitás un talle que no ves, consultanos y lo revisamos. ¡Saludos!"),
    ("Envíos", "Hola, ¿cómo estás? Hacemos envíos a todo el país por Mercado Envíos. El costo y el plazo te aparecen al ingresar tu código postal. ¡Saludos!"),
    ("Factura A", "Hola, ¿cómo estás? Sí, emitimos factura A. Una vez realizada la compra, envianos los datos fiscales por la mensajería de Mercado Libre. ¡Saludos!"),
    ("Mayorista", "Hola, ¿cómo estás? Somos fábrica y trabajamos por mayor. Para cantidades grandes o bordado de logo, escribinos por mensaje y te pasamos precio especial. ¡Saludos!"),
]


class RespuestaIn(BaseModel):
    titulo: str = Field(min_length=1, max_length=60)
    texto: str = Field(min_length=1, max_length=MAX_TEXTO)


def _out(r: MLQuickReply) -> dict:
    return {"id": r.id, "titulo": r.titulo, "texto": r.texto, "usos": r.usos}


@router.get("")
async def listar(db: AsyncSession = Depends(get_db)):
    """Most used first. The first call seeds a few examples."""
    total = await db.scalar(select(func.count()).select_from(MLQuickReply))
    if not total:
        db.add_all(MLQuickReply(titulo=t, texto=x) for t, x in INICIALES)
        await db.commit()
    res = await db.execute(select(MLQuickReply).order_by(MLQuickReply.usos.desc(), MLQuickReply.id))
    return [_out(r) for r in res.scalars()]


@router.post("", status_code=201)
async def crear(body: RespuestaIn, db: AsyncSession = Depends(get_db)):
    r = MLQuickReply(titulo=body.titulo.strip(), texto=body.texto.strip())
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _out(r)


@router.put("/{rid}")
async def editar(rid: int, body: RespuestaIn, db: AsyncSession = Depends(get_db)):
    r = await db.get(MLQuickReply, rid)
    if not r:
        raise HTTPException(status_code=404, detail="Esa respuesta ya no existe.")
    r.titulo, r.texto = body.titulo.strip(), body.texto.strip()
    await db.commit()
    return _out(r)


@router.delete("/{rid}")
async def borrar(rid: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(MLQuickReply, rid)
    if r:
        await db.delete(r)
        await db.commit()
    return {"ok": True}


@router.post("/{rid}/uso")
async def registrar_uso(rid: int, db: AsyncSession = Depends(get_db)):
    """Counts how often a reply is used, so the common ones show first."""
    r = await db.get(MLQuickReply, rid)
    if r:
        r.usos = (r.usos or 0) + 1
        await db.commit()
    return {"ok": True}
