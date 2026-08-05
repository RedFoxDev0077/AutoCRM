import os
import base64
import pdfplumber
import anthropic
from app.config import get_settings

settings = get_settings()

MAX_PDF_CHARS  = 6000   # truncate long PDFs
MAX_TXT_CHARS  = 3000   # truncate long notes
MAX_IMG_SIZE   = 800_000  # skip images larger than ~800 KB

SYSTEM_PROMPT = """Sos un asistente médico de IA especializado en análisis de estudios clínicos.

Datos del paciente:
- ID: IAF6612
- Diagnóstico: Cáncer de ovario con 2 recaídas

Tu rol es:
1. Analizar y explicar estudios médicos (laboratorio, imágenes, informes) en lenguaje claro
2. Comparar resultados a lo largo del tiempo para identificar tendencias
3. Buscar casos similares en tu conocimiento y explicar qué tratamientos se usan
4. Responder preguntas sobre los estudios y la condición médica
5. Sugerir preguntas para hacerle al médico tratante

IMPORTANTE: Siempre recordá que sos una IA de apoyo informativo. Toda decisión médica debe ser tomada por el equipo médico tratante."""


def _extract_pdf_text(path: str) -> str:
    try:
        with pdfplumber.open(path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        return text[:MAX_PDF_CHARS] + ("..." if len(text) > MAX_PDF_CHARS else "")
    except Exception:
        return ""


def _encode_image(path: str) -> tuple[str, str] | None:
    try:
        size = os.path.getsize(path)
        if size > MAX_IMG_SIZE:
            return None  # too large, skip
        ext = os.path.splitext(path)[1].lower()
        media_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                     ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
        media_type = media_map.get(ext, "image/jpeg")
        with open(path, "rb") as f:
            return base64.standard_b64encode(f.read()).decode(), media_type
    except Exception:
        return None


def load_studies_context(studies_dir: str) -> list[dict]:
    blocks = []
    if not os.path.isdir(studies_dir):
        return blocks

    for fname in sorted(os.listdir(studies_dir)):
        if fname.startswith("_"):
            continue
        fpath = os.path.join(studies_dir, fname)
        ext = os.path.splitext(fname)[1].lower()

        try:
            if ext == ".pdf":
                text = _extract_pdf_text(fpath)
                if text.strip():
                    blocks.append({
                        "type": "text",
                        "text": f"--- ESTUDIO PDF: {fname} ---\n{text}\n---",
                    })

            elif ext in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
                result = _encode_image(fpath)
                if result:
                    data, media_type = result
                    blocks.append({"type": "text", "text": f"--- IMAGEN: {fname} ---"})
                    blocks.append({
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": data},
                    })
                else:
                    # Too large to send — just mention it
                    blocks.append({
                        "type": "text",
                        "text": f"--- IMAGEN (muy grande para procesar): {fname} ---",
                    })

            elif ext == ".txt":
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                content = content[:MAX_TXT_CHARS] + ("..." if len(content) > MAX_TXT_CHARS else "")
                blocks.append({
                    "type": "text",
                    "text": f"--- NOTA: {fname} ---\n{content}\n---",
                })
        except Exception:
            # Skip broken files silently — don't crash the whole chat
            blocks.append({"type": "text", "text": f"--- ARCHIVO NO LEGIBLE: {fname} ---"})

    return blocks


async def chat(messages: list[dict], studies_dir: str) -> str:
    client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)

    study_blocks = load_studies_context(studies_dir)

    # Only keep the last 10 messages to avoid token overflow
    recent_messages = messages[-10:] if len(messages) > 10 else list(messages)

    if study_blocks:
        context_msg = {
            "role": "user",
            "content": [
                {"type": "text", "text": "Estos son los estudios y notas médicas del paciente:"},
                *study_blocks,
                {"type": "text", "text": "Tenelos en cuenta para responder mis preguntas."},
            ],
        }
        all_messages = [
            context_msg,
            {"role": "assistant", "content": "Entendido. Analicé todos los estudios disponibles. ¿En qué te puedo ayudar?"},
            *recent_messages,
        ]
    else:
        all_messages = recent_messages

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=all_messages,
    )
    return response.content[0].text
