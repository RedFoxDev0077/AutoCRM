import os
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import get_settings

SETTINGS_PATH = "/app/data/settings.json"


def load_custom_context() -> str:
    try:
        with open(SETTINGS_PATH) as f:
            return json.load(f).get("business_context", "")
    except Exception:
        return ""


def _save_settings_key(key: str, value) -> None:
    existing: dict = {}
    try:
        with open(SETTINGS_PATH) as f:
            existing = json.load(f)
    except Exception:
        pass
    existing[key] = value
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    with open(SETTINGS_PATH, "w") as f:
        json.dump(existing, f)

router = APIRouter(prefix="/social", tags=["social"])

PRODUCTS = {
    "pantalones": "pantalones de trabajo (cargo, clásico, náutico)",
    "buzos":      "buzos de friza lisos",
    "camperas":   "camperas trucker térmicas de trabajo",
    "mamelucos":  "mamelucos de trabajo",
    "ambos":      "ambos médicos unisex",
    "remeras":    "remeras de algodón lisa",
    "camisas":    "camisas de trabajo gabardina",
    "general":    "línea completa de indumentaria laboral",
}

# Best posting times for B2B workwear brand (Argentina timezone)
BEST_TIMES = {
    "instagram": "Martes y jueves 12-13hs · Miércoles y viernes 18-20hs · Lunes 8-9hs",
    "facebook":  "Martes a jueves 9-11hs · Miércoles 12-13hs · Viernes 15-16hs",
    "ambas":     "IG: Mar/Jue 12-13hs y 18-20hs · FB: Mar-Jue 9-11hs",
}


BRAND_SYSTEM = """Sos el social media manager de Indumentaria Segura SRL (@_indseg en Instagram y Facebook).

EMPRESA: Fabricante argentina de indumentaria laboral con 15+ años en el mercado. Clientes principales: empresas industriales, constructoras, frigoríficos, hospitales, municipios, distribuidores y comercios. También venden a minoristas por Mercado Libre.

PRODUCTOS Y MATERIALES:
- Pantalones cargo, clásico y náutico de trabajo
- Buzos de friza lisa (varios colores)
- Camperas trucker térmicas (tela trucker, interior matelassé, capucha desmontable, guata 150g)
- Mamelucos de trabajo
- Ambos médicos unisex
- Remeras de algodón lisas
- Camisas de trabajo gabardina
- Talles S al 3XL — fabricación propia en Argentina

DIFERENCIALES CLAVE:
- Fabricación propia (no revendedores)
- Personalización con logo de la empresa
- Venta por cantidad / mayorista
- Entrega a todo el país
- Contacto directo: WhatsApp +54 11 2301-1926 o Mercado Libre

REGLAS DE ESCRITURA:
- Español argentino (vos, ustedes — nunca "tú")
- Tono directo y confiable, no discurso publicitario vacío
- Orientar siempre al B2B: equipar al equipo, no compra personal
- Emojis: máximo 3-4, solo si suman (no decorativos)
- Sin mayúsculas excesivas, sin signos de exclamación innecesarios
- El CTA siempre menciona WhatsApp o Mercado Libre"""


async def _call_claude(prompt: str, max_tokens: int, settings, system: str = "") -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": max_tokens,
                "system": system or BRAND_SYSTEM,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


def _parse_sections(raw: str, keys: list[str]) -> dict[str, str]:
    sections: dict[str, str] = {}
    for i, key in enumerate(keys):
        start = raw.find(f"{key}:")
        if start == -1:
            continue
        start += len(key) + 1
        end = len(raw)
        for other in keys[i + 1:]:
            pos = raw.find(f"{other}:", start)
            if pos != -1 and pos < end:
                end = pos
        sections[key.lower()] = raw[start:end].strip()
    return sections


class BusinessContextRequest(BaseModel):
    context: str


@router.get("/business-context")
async def get_business_context():
    return {"context": load_custom_context()}


@router.post("/business-context")
async def save_business_context(req: BusinessContextRequest):
    try:
        _save_settings_key("business_context", req.context.strip())
        return {"saved": True}
    except Exception as e:
        raise HTTPException(500, str(e))


class ContentRequest(BaseModel):
    product: str
    platform: str
    tone: str
    context: str = ""


class CampaignRequest(BaseModel):
    product: str
    platform: str
    goal: str       # ventas | branding | engagement
    days: int = 7   # 7 or 14
    context: str = ""


@router.post("/content")
async def generate_content(req: ContentRequest):
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY no configurada")

    custom_ctx = load_custom_context()
    if custom_ctx:
        _active_system = custom_ctx
    else:
        _active_system = BRAND_SYSTEM

    product_desc = PRODUCTS.get(req.product, req.product)
    platform_map = {"instagram": "Instagram", "facebook": "Facebook", "ambas": "Instagram y Facebook"}
    tone_map = {
        "profesional":      "profesional y corporativo",
        "descontracturado": "amigable, cercano y descontracturado",
        "urgente":          "urgente (oferta por tiempo limitado)",
        "informativo":      "informativo y educativo",
    }
    platform_desc = platform_map.get(req.platform, req.platform)
    tone_desc = tone_map.get(req.tone, req.tone)
    context_part = f"\nContexto extra: {req.context}" if req.context else ""

    prompt = f"""Generá contenido para {platform_desc} para promocionar: {product_desc}.
Tono: {tone_desc}.{context_part}

El post tiene que sonar auténtico, no a plantilla genérica. Debe hablar directamente a quien equipa a su equipo de trabajo (dueño de empresa, jefe de planta, encargado de compras).

Respondé con exactamente estas 4 secciones (sin asteriscos, sin Markdown, sin negrita):

POST:
[copy completo del post — máximo 5 líneas, incluye emojis relevantes, menciona el diferencial principal del producto y termina generando curiosidad o interacción]

HASHTAGS:
[exactamente 15 hashtags, mezcla de: nicho (#ropaDeTrabajo #uniformesLaborales), producto (#camperas #mamelucos), locales (#Argentina #Pymes #Industria) y marca (#Indseg #IndumentariaSegura)]

CTA:
[una sola frase de llamada a la acción que mencione WhatsApp o Mercado Libre y sea específica — no usar "contactanos" genérico]

HISTORIA:
[texto ultra corto para stories de Instagram, máximo 2 líneas, impacto inmediato]"""

    try:
        raw = await _call_claude(prompt, 800, settings, system=_active_system)
    except Exception as e:
        raise HTTPException(500, f"Error generando contenido: {e}")

    sections = _parse_sections(raw, ["POST", "HASHTAGS", "CTA", "HISTORIA"])
    return {
        "post":       sections.get("post", ""),
        "hashtags":   sections.get("hashtags", ""),
        "cta":        sections.get("cta", ""),
        "historia":   sections.get("historia", ""),
        "best_times": BEST_TIMES.get(req.platform, BEST_TIMES["instagram"]),
    }


@router.post("/campaign")
async def generate_campaign(req: CampaignRequest):
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY no configurada")

    custom_ctx = load_custom_context()
    _active_system = custom_ctx if custom_ctx else BRAND_SYSTEM

    product_desc = PRODUCTS.get(req.product, req.product)
    platform_map = {"instagram": "Instagram", "facebook": "Facebook", "ambas": "Instagram y Facebook"}
    goal_map = {
        "ventas":     "generar ventas directas y consultas por WhatsApp/ML",
        "branding":   "fortalecer la marca y aumentar reconocimiento",
        "engagement": "aumentar interacción, seguidores y comunidad",
    }
    platform_desc = platform_map.get(req.platform, req.platform)
    goal_desc = goal_map.get(req.goal, req.goal)
    context_part = f"\nContexto extra: {req.context}" if req.context else ""

    prompt = f"""Creá un plan de campaña de {req.days} días para {platform_desc}.
Producto foco: {product_desc}. Objetivo: {goal_desc}.{context_part}

Cada día debe tener un ángulo diferente (beneficio, prueba social, proceso de fabricación, caso de uso, oferta, detrás de escena, etc.). El copy debe sonar auténtico y estar orientado a empresas que buscan equipar a su personal — no a consumidores individuales.

Respondé con exactamente {req.days} bloques con este formato exacto (sin asteriscos ni Markdown):

DIA 1:
TIPO: [Feed / Historia / Carrusel / Reel / Encuesta]
FOCO: [ángulo o tema del día — una frase concreta]
COPY: [copy completo listo para publicar, con emojis]
HASHTAGS: [10 hashtags relevantes]
HORARIO: [hora recomendada para Argentina]

DIA 2:
TIPO: ...
(continuar hasta DIA {req.days})

Al final agregar:

VARIACIONES A/B:
[2 versiones alternativas de copy con enfoques bien distintos — una más emocional, otra más racional/datos]

TIPS DE OPTIMIZACIÓN:
[3 consejos específicos para esta campaña y este producto — no genéricos]"""

    try:
        raw = await _call_claude(prompt, 3000 if req.days == 14 else 1800, settings, system=_active_system)
    except Exception as e:
        raise HTTPException(500, f"Error generando campaña: {e}")

    # Parse day blocks
    days = []
    for i in range(1, req.days + 1):
        marker = f"DIA {i}:"
        start = raw.find(marker)
        if start == -1:
            continue
        start += len(marker)
        end_marker = f"DIA {i + 1}:" if i < req.days else "VARIACIONES A/B:"
        end = raw.find(end_marker, start)
        if end == -1:
            end = len(raw)
        block = raw[start:end].strip()

        day_data: dict[str, str] = {"day": str(i)}
        for field in ["TIPO", "FOCO", "COPY", "HASHTAGS", "HORARIO"]:
            fs = block.find(f"{field}:")
            if fs == -1:
                continue
            fs += len(field) + 1
            fe = len(block)
            for other in ["TIPO", "FOCO", "COPY", "HASHTAGS", "HORARIO"]:
                if other == field:
                    continue
                op = block.find(f"{other}:", fs)
                if op != -1 and op < fe:
                    fe = op
            day_data[field.lower()] = block[fs:fe].strip()
        days.append(day_data)

    # Parse extras
    extras = _parse_sections(raw, ["VARIACIONES A/B", "TIPS DE OPTIMIZACIÓN"])

    return {
        "days": days,
        "ab_variations": extras.get("variaciones a/b", ""),
        "tips": extras.get("tips de optimización", ""),
        "best_times": BEST_TIMES.get(req.platform, BEST_TIMES["instagram"]),
    }
