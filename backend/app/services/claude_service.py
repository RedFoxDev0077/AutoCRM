import json
import anthropic
from app.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """Sos un experto en SEO y optimización de publicaciones para Mercado Libre Argentina.
Tu tarea es mejorar títulos y descripciones de productos para maximizar visibilidad en el buscador interno de ML.

Reglas estrictas:
- Título: máximo 60 caracteres, incluir marca/modelo/característica principal/condición
- Descripción: mínima 200 palabras, incluir palabras clave naturalmente, beneficios, especificaciones
- Usar mayúsculas en palabras clave del título
- NO usar signos de exclamación ni promesas exageradas
- Responder SIEMPRE en JSON válido con las claves: title, description, improvements

Formato de respuesta:
{
  "title": "título optimizado aquí",
  "description": "descripción optimizada aquí",
  "improvements": "lista de mejoras realizadas"
}"""


class ClaudeService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def optimize_listing(self, title: str, description: str, category: str = "") -> dict:
        user_message = f"""Optimizá esta publicación de Mercado Libre:

TÍTULO ACTUAL: {title}
DESCRIPCIÓN ACTUAL: {description or 'Sin descripción'}
CATEGORÍA: {category or 'General'}

Devolvé el JSON con el título y descripción optimizados."""

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_message}],
        )

        text = response.content[0].text.strip()
        # Extract JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "title": title,
                "description": description,
                "improvements": "Error al procesar la respuesta de IA",
            }

    async def suggest_replies(self, messages: list[dict], lead_context: dict) -> list[dict]:
        """Generate 3 WhatsApp reply suggestions with different tones."""
        history = "\n".join(
            f"{'Cliente' if m['direction'] == 'inbound' else 'Vendedor'}: {m['content']}"
            for m in messages[-10:]
            if m.get("content")
        )
        ctx_parts = []
        if lead_context.get("name"):
            ctx_parts.append(f"Nombre: {lead_context['name']}")
        if lead_context.get("tags"):
            ctx_parts.append(f"Etiquetas: {', '.join(lead_context['tags'])}")
        if lead_context.get("stage"):
            ctx_parts.append(f"Etapa en CRM: {lead_context['stage']}")
        ctx = "\n".join(ctx_parts) or "Lead sin datos adicionales"

        prompt = f"""Sos un asistente de ventas de Indumentaria Segura SRL, empresa argentina de ropa de trabajo y seguridad laboral.

CONTEXTO DEL LEAD:
{ctx}

HISTORIAL DE CONVERSACIÓN:
{history}

Generá EXACTAMENTE 3 respuestas diferentes para continuar esta conversación de WhatsApp.
Cada respuesta debe ser corta (máximo 2 oraciones), natural, en español argentino (tuteo).

Responde SOLO con JSON válido, sin texto adicional:
{{
  "suggestions": [
    {{"tone": "profesional", "text": "..."}},
    {{"tone": "cercano", "text": "..."}},
    {{"tone": "cierre", "text": "..."}}
  ]
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(raw).get("suggestions", [])
        except Exception:
            return [
                {"tone": "profesional", "text": "Hola, gracias por tu mensaje. ¿En qué te podemos ayudar?"},
                {"tone": "cercano",     "text": "¡Hola! Contame, ¿qué necesitás?"},
                {"tone": "cierre",      "text": "¡Hola! Podemos ayudarte con eso. ¿Cuándo querés que te contactemos?"},
            ]

    async def generate_listing(self, title: str, ref_description: str = "", category: str = "") -> dict:
        user_message = f"""Creá una publicación NUEVA y ORIGINAL para Mercado Libre Argentina, basándote en esta referencia:

TÍTULO DE REFERENCIA: {title}
DESCRIPCIÓN DE REFERENCIA: {ref_description or 'No disponible'}
CATEGORÍA: {category or 'Indumentaria / moda'}

Importante: el contenido debe ser ORIGINAL (no copiar textual). Adaptalo para una marca de indumentaria de seguridad laboral argentina.
Devolvé el JSON con title, description, improvements."""

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"title": title, "description": ref_description, "improvements": "Error al procesar"}
