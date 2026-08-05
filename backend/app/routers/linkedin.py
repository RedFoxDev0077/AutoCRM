import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import get_settings

router = APIRouter(prefix="/linkedin", tags=["linkedin"])

CLAUDE_HEADERS = lambda key: {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
}


async def _call_claude(prompt: str, max_tokens: int, settings) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=CLAUDE_HEADERS(settings.ANTHROPIC_API_KEY),
            json={"model": "claude-haiku-4-5-20251001", "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


class MessageRequest(BaseModel):
    prospect_name: str
    company: str = ""
    role: str = ""
    goal: str = ""
    context: str = ""


class ProfileRequest(BaseModel):
    headline: str = ""
    summary: str = ""
    experience: str = ""
    industry: str = ""
    target: str = ""


@router.post("/message")
async def generate_linkedin_message(req: MessageRequest):
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY no configurada")

    company_part = f" de {req.company}" if req.company else ""
    role_part = f", {req.role}," if req.role else ","
    goal_text = req.goal or "presentar Indumentaria Segura y explorar si necesitan indumentaria laboral"
    context_part = f"\nContexto adicional: {req.context}" if req.context else ""

    prompt = f"""Sos el director comercial de Indumentaria Segura SRL, empresa argentina de indumentaria y uniformes laborales (pantalones, buzos, camperas, mamelucos, ambos médicos). Trabajamos con empresas, fábricas, clínicas y comercios de todo el país.

Escribí un mensaje de conexión para LinkedIn para enviarle a {req.prospect_name}{company_part}{role_part} con el objetivo de: {goal_text}.{context_part}

Requisitos:
- Máximo 4-5 oraciones
- Mencioná algo específico de su industria cuando sea relevante
- Tono genuino, no comercial agresivo
- Terminar con una pregunta abierta o CTA suave
- Español argentino, formal pero no rígido

Solo el texto del mensaje, sin saludos genéricos tipo "Espero que estés bien", sin explicaciones."""

    try:
        message = await _call_claude(prompt, 400, settings)
    except Exception as e:
        raise HTTPException(500, f"Error generando mensaje: {e}")

    return {"message": message.strip()}


@router.post("/profile")
async def optimize_linkedin_profile(req: ProfileRequest):
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY no configurada")

    current_parts = []
    if req.headline:    current_parts.append(f"TITULAR ACTUAL:\n{req.headline}")
    if req.summary:     current_parts.append(f"RESUMEN ACTUAL:\n{req.summary}")
    if req.experience:  current_parts.append(f"EXPERIENCIA ACTUAL:\n{req.experience}")
    current_text = "\n\n".join(current_parts) if current_parts else "Sin contenido actual — generar desde cero para dueño de empresa de indumentaria laboral."

    industry = req.industry or "indumentaria laboral y uniformes de trabajo"
    target   = req.target   or "empresas, industrias, pymes y comercios que necesitan uniformes"

    prompt = f"""Sos un experto en personal branding y LinkedIn para el mercado argentino B2B. Tu cliente es el dueño/director de Indumentaria Segura SRL, empresa argentina de indumentaria laboral (uniformes, pantalones de trabajo, buzos, camperas, mamelucos, ambos médicos).

Industria: {industry}
Público objetivo: {target}

{current_text}

Reescribí el perfil de LinkedIn para que sea profesional, atractivo y genere confianza en compradores corporativos. Sin asteriscos, sin Markdown, con estas 4 secciones exactas:

TITULAR:
[máximo 220 caracteres — cargo + propuesta de valor + keywords relevantes]

RESUMEN:
[3 párrafos en primera persona: quién soy / qué problema resuelvo / CTA. Máximo 2000 caracteres.]

EXPERIENCIA:
[Descripción del cargo actual en Indumentaria Segura con logros clave en bullets. Máximo 5 bullets.]

KEYWORDS:
[12 palabras clave separadas por coma para optimizar búsquedas en LinkedIn]"""

    try:
        raw = await _call_claude(prompt, 1200, settings)
    except Exception as e:
        raise HTTPException(500, f"Error optimizando perfil: {e}")

    sections: dict[str, str] = {}
    keys = ["TITULAR", "RESUMEN", "EXPERIENCIA", "KEYWORDS"]
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
