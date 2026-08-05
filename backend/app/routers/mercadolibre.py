import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

ML_KOMMO_SYNC_FILE = Path("/app/data/ml_kommo_sync.json")

def _load_synced_questions() -> set:
    if ML_KOMMO_SYNC_FILE.exists():
        try:
            return set(json.loads(ML_KOMMO_SYNC_FILE.read_text()).get("ids", []))
        except Exception:
            pass
    return set()

def _save_synced_questions(ids: set):
    ML_KOMMO_SYNC_FILE.parent.mkdir(parents=True, exist_ok=True)
    ML_KOMMO_SYNC_FILE.write_text(json.dumps({"ids": list(ids)}))
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.database import get_db
from app.models.listing import Listing, ListingStatus
from app.models.ml_order import MLOrder
from app.schemas.listing import ListingResponse
from app.services.ml_service import MLService, ml_is_connected, ML_TOKEN_FILE, ML_ID_RE
from app.services.claude_service import ClaudeService
import httpx

router = APIRouter(prefix="/ml", tags=["mercadolibre"])

ML_REDIRECT_URI = "https://panel.indumentariasegura.com.ar/api/ml/callback"


@router.get("/status")
async def ml_status():
    from app.config import get_settings
    s = get_settings()
    if not s.ML_APP_ID or not s.ML_APP_SECRET:
        return {"connected": False}
    return {"connected": ml_is_connected()}


@router.get("/connected")
async def ml_connected():
    return {"connected": ml_is_connected()}


@router.get("/auth-url")
async def ml_auth_url():
    from app.config import get_settings
    s = get_settings()
    url = (
        f"https://auth.mercadolibre.com.ar/authorization"
        f"?response_type=code&client_id={s.ML_APP_ID}"
        f"&redirect_uri={ML_REDIRECT_URI}"
        f"&scope=offline_access+read+write+orders+order_purchase_read"
    )
    return {"auth_url": url}


@router.get("/callback", response_class=HTMLResponse)
async def ml_callback(code: str = Query(None), error: str = Query(None)):
    from app.config import get_settings
    s = get_settings()

    if error or not code:
        return HTMLResponse("""
        <html><body style="font-family:Arial;text-align:center;padding:60px">
        <h2 style="color:#e53e3e">Error al conectar con Mercado Libre</h2>
        <p>Cerrá esta ventana e intentá de nuevo.</p>
        </body></html>
        """)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": s.ML_APP_ID,
                "client_secret": s.ML_APP_SECRET,
                "code": code,
                "redirect_uri": ML_REDIRECT_URI,
            },
            timeout=15,
        )
        data = resp.json()

    if "access_token" not in data:
        return HTMLResponse(f"""
        <html><body style="font-family:Arial;text-align:center;padding:60px">
        <h2 style="color:#e53e3e">Error al obtener token</h2>
        <p>{data.get('message', str(data))}</p>
        </body></html>
        """)

    ML_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    ML_TOKEN_FILE.write_text(json.dumps({
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", ""),
        "user_id": str(data.get("user_id", "")),
    }))

    return HTMLResponse("""
    <html><body style="font-family:Arial;text-align:center;padding:60px">
    <h2 style="color:#16713e">Mercado Libre conectado correctamente</h2>
    <p>Esta ventana se cierra automáticamente...</p>
    <script>setTimeout(() => window.close(), 2500)</script>
    </body></html>
    """)


@router.get("/listings", response_model=list[ListingResponse])
async def get_listings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).order_by(desc(Listing.created_at)))
    return result.scalars().all()


@router.get("/listings/pending", response_model=list[ListingResponse])
async def get_pending(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Listing).where(Listing.status == ListingStatus.pending).order_by(desc(Listing.created_at))
    )
    return result.scalars().all()


@router.post("/listings/sync")
async def sync_listings(db: AsyncSession = Depends(get_db)):
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")

    svc = MLService()
    try:
        item_ids = await svc.get_user_listings()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ML API error: {e}")

    synced = 0
    for item_id in item_ids:
        existing = await db.scalar(select(Listing).where(Listing.ml_id == item_id))
        try:
            detail = await svc.get_listing_detail(item_id)
            if existing:
                # Update stock on existing listings
                existing.available_quantity = detail.get("available_quantity", 0)
                existing.price = detail.get("price", existing.price)
                continue
            description = await svc.get_listing_description(item_id)
            listing = Listing(
                ml_id=item_id,
                title=detail.get("title", ""),
                description=description,
                original_title=detail.get("title", ""),
                original_description=description,
                price=detail.get("price", 0),
                available_quantity=detail.get("available_quantity", 0),
                category_id=detail.get("category_id", ""),
                thumbnail=detail.get("thumbnail", ""),
                permalink=detail.get("permalink", ""),
                status=ListingStatus.synced,
            )
            db.add(listing)
            synced += 1
        except Exception:
            continue

    await db.commit()
    return {"synced": synced, "total_in_ml": len(item_ids)}


@router.post("/listings/{listing_id}/optimize", response_model=ListingResponse)
async def optimize_listing(listing_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    claude = ClaudeService()
    try:
        suggestion = await claude.optimize_listing(
            title=listing.original_title,
            description=listing.original_description or "",
            category=listing.category_id or "",
        )
        listing.ai_suggested_title = suggestion.get("title", listing.title)
        listing.ai_suggested_description = suggestion.get("description", listing.description)
        listing.ai_improvements = suggestion.get("improvements", "")
        listing.status = ListingStatus.pending
        await db.commit()
        await db.refresh(listing)
        return listing
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude AI error: {e}")


@router.put("/listings/{listing_id}/approve", response_model=ListingResponse)
async def approve_listing(listing_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not listing.ai_suggested_title:
        raise HTTPException(status_code=400, detail="No AI suggestion available")

    svc = MLService()
    try:
        await svc.update_listing(listing.ml_id, listing.ai_suggested_title)
        if listing.ai_suggested_description:
            await svc.update_description(listing.ml_id, listing.ai_suggested_description)
        listing.title = listing.ai_suggested_title
        listing.description = listing.ai_suggested_description
        listing.status = ListingStatus.approved
        await db.commit()
        await db.refresh(listing)
        return listing
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ML update error: {e}")


class EditListingBody(BaseModel):
    title: str
    price: float
    quantity: int
    description: str = ""


@router.put("/listings/{listing_id}/edit", response_model=ListingResponse)
async def edit_listing(listing_id: int, body: EditListingBody, db: AsyncSession = Depends(get_db)):
    """Manually edit listing title, price, and stock — pushes directly to ML."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")

    svc = MLService()
    try:
        await svc.update_listing(listing.ml_id, body.title, price=body.price, quantity=body.quantity)
        if body.description:
            await svc.update_description(listing.ml_id, body.description)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ML update error: {e}")

    listing.title = body.title
    listing.price = body.price
    listing.available_quantity = body.quantity
    if body.description:
        listing.description = body.description
    await db.commit()
    await db.refresh(listing)
    return listing


@router.put("/listings/{listing_id}/reject", response_model=ListingResponse)
async def reject_listing(listing_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.status = ListingStatus.rejected
    listing.ai_suggested_title = None
    listing.ai_suggested_description = None
    await db.commit()
    await db.refresh(listing)
    return listing


# ── Sales ─────────────────────────────────────────────────────

@router.post("/webhook")
async def ml_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receives real-time order notifications from ML webhook."""
    try:
        body = await request.json()
    except Exception:
        return {"status": "ok"}

    topic = body.get("topic", "") or body.get("type", "")
    resource = body.get("resource", "")

    print(f"[ml_webhook] topic={topic!r} resource={resource!r} body={str(body)[:200]}")

    if "order" not in topic.lower() and "order" not in resource.lower():
        return {"status": "ok"}

    # Extract order ID from resource path like /orders/123456
    order_id_str = resource.strip("/").split("/")[-1] if resource else ""
    if not order_id_str or not order_id_str.isdigit():
        return {"status": "ok"}

    # Avoid duplicates
    existing = await db.scalar(select(MLOrder).where(MLOrder.ml_order_id == order_id_str))
    if existing:
        return {"status": "ok"}

    # Fetch order detail from ML API
    try:
        svc = MLService()
        async with httpx.AsyncClient() as client:
            resp = await svc._authed_get(
                client, f"https://api.mercadolibre.com/orders/{order_id_str}", timeout=15
            )
            if resp.status_code != 200:
                return {"status": "ok"}
            order = resp.json()

        items = order.get("order_items", [])
        first = items[0] if items else {}
        order_date_str = order.get("date_created", "")
        buyer_nickname = order.get("buyer", {}).get("nickname", "")
        try:
            order_date = datetime.fromisoformat(order_date_str.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            order_date = datetime.utcnow()

        db.add(MLOrder(
            ml_order_id=order_id_str,
            status=order.get("status", "paid"),
            total_amount=order.get("total_amount", 0),
            title=first.get("item", {}).get("title", ""),
            item_id=first.get("item", {}).get("id", ""),
            quantity=sum(i.get("quantity", 1) for i in items),
            buyer_nickname=buyer_nickname,
            order_date=order_date,
        ))
        await db.commit()

    except Exception as e:
        print(f"[ml_webhook] order fetch error: {e}")

    return {"status": "ok"}


@router.post("/sales/sync")
async def sync_sales(db: AsyncSession = Depends(get_db)):
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")
    svc = MLService()
    try:
        data = await svc.get_daily_sales()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ML API error: {e}")

    synced = 0
    for o in data.get("orders", []):
        order_id_str = str(o["id"])
        existing = await db.scalar(select(MLOrder).where(MLOrder.ml_order_id == order_id_str))
        if existing:
            continue
        try:
            order_date = datetime.fromisoformat(o["date"].replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None) if o.get("date") else datetime.utcnow()
        except Exception:
            order_date = datetime.utcnow()
        db.add(MLOrder(
            ml_order_id=order_id_str,
            status="paid",
            total_amount=o.get("total", 0),
            title=o.get("title", ""),
            item_id=o.get("item_id", ""),
            quantity=o.get("quantity", 1),
            buyer_nickname="",
            order_date=order_date,
        ))
        synced += 1
    await db.commit()
    return {"synced": synced, "total_orders": data.get("count", 0)}


@router.get("/sales/daily")
async def get_daily_sales():
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")
    svc = MLService()
    try:
        return await svc.get_daily_sales()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Questions ────────────────────────────────────────────────

@router.post("/questions/sync-kommo")
async def sync_questions_to_kommo():
    """Push unanswered ML questions as leads in EMBUDO MERCADO LIBRE, one per product stage."""
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")
    from app.services.kommo_service import KommoService
    svc_ml = MLService()
    svc_kommo = KommoService()
    try:
        questions = await svc_ml.get_received_questions("UNANSWERED")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    synced_ids = _load_synced_questions()
    created = 0
    for q in questions:
        qid = str(q.get("id", ""))
        if not qid or qid in synced_ids:
            continue
        # ML questions disabled from Kommo sync — no contact data available
        pass

    _save_synced_questions(synced_ids)
    return {"created": created, "total_questions": len(questions)}


@router.get("/questions")
async def get_questions(status: str = "UNANSWERED"):
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")
    svc = MLService()
    try:
        return await svc.get_received_questions(status)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class AnswerBody(BaseModel):
    text: str


@router.post("/questions/{question_id}/answer")
async def answer_question(question_id: int, body: AnswerBody):
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")
    svc = MLService()
    try:
        return await svc.answer_question(question_id, body.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── AI Listing Generator ──────────────────────────────────────

class GenerateBody(BaseModel):
    title: str = ""
    competitor_url: str = ""


@router.post("/listings/generate")
async def generate_listing(body: GenerateBody):
    ref_title = body.title.strip()
    ref_description = ""
    category_id = ""

    if body.competitor_url:
        match = ML_ID_RE.search(body.competitor_url)
        if match:
            item_id = match.group(1).upper()
            svc = MLService()
            try:
                item = await svc.get_item_public(item_id)
                ref_title = ref_title or item.get("title", "")
                category_id = item.get("category_id", "")
                ref_description = await svc.get_listing_description(item_id)
            except Exception:
                pass

    if not ref_title:
        raise HTTPException(status_code=400, detail="Se requiere un título o URL de referencia")

    claude = ClaudeService()
    try:
        suggestion = await claude.generate_listing(ref_title, ref_description, category_id)
        return {**suggestion, "category_id": category_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PublishBody(BaseModel):
    title: str
    description: str
    price: float
    quantity: int
    condition: str = "new"
    category_id: str = ""


@router.post("/listings/publish")
async def publish_listing(body: PublishBody):
    if not ml_is_connected():
        raise HTTPException(status_code=400, detail="ML_NOT_CONNECTED")
    svc = MLService()

    category_id = body.category_id
    if not category_id:
        category_id = await svc.predict_category(body.title)

    item_data = {
        "title": body.title,
        "category_id": category_id,
        "price": body.price,
        "currency_id": "ARS",
        "available_quantity": body.quantity,
        "buying_mode": "buy_it_now",
        "condition": body.condition,
        "listing_type_id": "gold_special",
        "description": {"plain_text": body.description},
    }
    try:
        result = await svc.create_listing(item_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ML error: {e}")


# ── Feature 3: Budget Analysis ────────────────────────────────

@router.get("/budget-analysis")
async def budget_analysis(db: AsyncSession = Depends(get_db)):
    """AI analysis of listings performance → suggested budget allocation per product."""
    result = await db.execute(select(Listing).order_by(Listing.updated_at.desc()).limit(30))
    listings = result.scalars().all()
    if not listings:
        raise HTTPException(status_code=404, detail="No hay publicaciones sincronizadas aún")

    listings_summary = "\n".join([
        f"- ID: {l.ml_id} | Título: {l.title} | Precio: ${l.price or 0} | Stock: {l.available_quantity or 0} | Estado: {l.status.value if l.status else 'desconocido'}"
        for l in listings
    ])

    claude = ClaudeService()
    prompt = f"""Sos un experto en inversión publicitaria en Mercado Libre Argentina.
Analizá estas publicaciones de Indumentaria Segura SRL (ropa de trabajo mayorista) y recomendá cómo distribuir el presupuesto publicitario en ML Ads.

PUBLICACIONES ACTUALES:
{listings_summary}

Devolvé un JSON con esta estructura exacta:
{{
  "resumen": "análisis general del portfolio en 2-3 oraciones",
  "recomendaciones": [
    {{
      "item_id": "MLA...",
      "titulo": "título corto",
      "prioridad": "alta|media|baja",
      "presupuesto_sugerido_pct": 30,
      "razon": "por qué invertir aquí"
    }}
  ],
  "estrategia": "consejo general de estrategia publicitaria para este tipo de negocio",
  "advertencias": "riesgos o publicaciones que NO deberían recibir inversión"
}}"""

    try:
        response = claude.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        start = text.find("{")
        end   = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature 4: Competitor Comparison ─────────────────────────

class CompareBody(BaseModel):
    listing_id: int = 0
    competitor_url: str


@router.post("/listings/compare")
async def compare_listing(body: CompareBody, db: AsyncSession = Depends(get_db)):
    """Compare our listing vs a competitor's and return structured analysis."""
    our_listing = None
    if body.listing_id:
        res = await db.execute(select(Listing).where(Listing.id == body.listing_id))
        our_listing = res.scalar_one_or_none()

    match = ML_ID_RE.search(body.competitor_url)
    if not match:
        raise HTTPException(status_code=400, detail="URL de competidor inválida")

    svc = MLService()
    try:
        comp_item = await svc.get_item_public(match.group(1).upper())
        comp_desc = await svc.get_listing_description(match.group(1).upper())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al obtener publicación: {e}")

    our_block = ""
    if our_listing:
        our_block = f"""NUESTRA PUBLICACIÓN:
- Título: {our_listing.title}
- Precio: ${our_listing.price or 'N/A'}
- Stock: {our_listing.available_quantity or 'N/A'}"""
    else:
        our_block = "NUESTRA PUBLICACIÓN: No seleccionada (solo analizar al competidor)"

    comp_block = f"""PUBLICACIÓN DEL COMPETIDOR:
- Título: {comp_item.get('title', '')}
- Precio: ${comp_item.get('price', 'N/A')}
- Condición: {comp_item.get('condition', '')}
- Disponibles: {comp_item.get('available_quantity', 'N/A')}
- Descripción: {(comp_desc or '')[:400]}"""

    claude = ClaudeService()
    prompt = f"""Sos un experto en posicionamiento en Mercado Libre Argentina.
Analizá estas dos publicaciones y devolvé una comparación estructurada.

{our_block}

{comp_block}

Devolvé un JSON con esta estructura:
{{
  "ventajas_competidor": ["lista de ventajas del competidor"],
  "desventajas_competidor": ["lista de debilidades del competidor"],
  "precio": {{"nuestra": "X", "competidor": "Y", "diferencia_pct": 0, "recomendacion": "texto"}},
  "titulo": {{"analisis": "comparación de títulos y keywords", "sugerencia_mejora": "título mejorado sugerido"}},
  "descripcion": {{"analisis": "qué hace mejor el competidor en su descripción", "sugerencia": "qué agregar"}},
  "puntaje_competidor": 7,
  "puntaje_nuestro": 5,
  "accion_prioritaria": "la única cosa más importante a cambiar en nuestra publicación"
}}"""

    try:
        response = claude.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        start = text.find("{")
        end   = text.rfind("}") + 1
        data = json.loads(text[start:end])
        data["competitor_title"] = comp_item.get("title", "")
        data["competitor_price"] = comp_item.get("price")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
