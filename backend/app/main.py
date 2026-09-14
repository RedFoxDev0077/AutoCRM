import asyncio
import os
import jwt
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from app.database import init_db, AsyncSessionLocal
from app.config import get_settings
from app.routers import dashboard, kommo, whatsapp, leads, mercadolibre, push, auth as auth_router
from app.routers import social, linkedin, google_ads, social_publish, cotizador


async def _poll_ml_and_push():
    from app.services.ml_service import MLService, ml_is_connected
    from app.services.push_service import send_push_to_all

    last_count: int | None = None
    while True:
        await asyncio.sleep(5 * 60)
        try:
            if not ml_is_connected():
                continue
            svc = MLService()
            questions = await svc.get_received_questions("UNANSWERED")
            count = len(questions)
            if last_count is not None and count > last_count:
                diff = count - last_count
                s = "s" if diff > 1 else ""
                async with AsyncSessionLocal() as db:
                    await send_push_to_all(
                        db,
                        "AutoCRM — Nueva pregunta en ML",
                        f"Tenés {diff} pregunta{s} nueva{s} sin responder",
                        "/mercadolibre",
                    )
            last_count = count
        except Exception as exc:
            print(f"[poll_ml] {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(_poll_ml_and_push())
    yield
    task.cancel()


app = FastAPI(title="AutoCRM API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths that never require a JWT (webhooks + auth endpoints + public pages)
_PUBLIC_PATHS = {
    "/api/auth/login",
    "/api/whatsapp/webhook",
    "/api/ml/webhook",
    "/api/ml/callback",
    "/api/kommo/webhook",
    "/api/google-ads/webhook",
    "/health",
    "/privacy",
}


@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
        return await call_next(request)
    if request.url.path.startswith("/api/"):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        try:
            jwt.decode(auth.split(" ")[1], get_settings().JWT_SECRET, algorithms=["HS256"])
        except Exception:
            return JSONResponse({"detail": "Token inválido o expirado"}, status_code=401)
    return await call_next(request)


app.include_router(auth_router.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(kommo.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(mercadolibre.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(social.router, prefix="/api")
app.include_router(social_publish.router, prefix="/api")
app.include_router(linkedin.router, prefix="/api")
app.include_router(google_ads.router, prefix="/api")
app.include_router(cotizador.router, prefix="/api")

_UPLOAD_DIR = "/app/data/uploads"
os.makedirs(_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/google/status")
async def google_status():
    import httpx
    key = get_settings().GOOGLE_PLACES_API_KEY
    if not key:
        return {"connected": False}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": "test", "key": key}, timeout=8
            )
            data = resp.json()
            return {"connected": data.get("status") in ("OK", "ZERO_RESULTS")}
    except Exception:
        return {"connected": False}


@app.get("/api/claude/status")
async def claude_status():
    import httpx
    key = get_settings().ANTHROPIC_API_KEY
    if not key:
        return {"connected": False}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": "claude-haiku-4-5-20251001", "max_tokens": 5, "messages": [{"role": "user", "content": "hi"}]},
                timeout=10,
            )
            return {"connected": resp.status_code == 200}
    except Exception:
        return {"connected": False}


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return """<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Política de Privacidad - AutoCRM</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333}h1{color:#1a1a1a}h2{color:#444;margin-top:30px}p{line-height:1.7}</style>
</head>
<body>
<h1>Política de Privacidad</h1>
<p><strong>Indumentaria Segura SRL</strong> — AutoCRM Platform</p>
<p>Última actualización: 14 de mayo de 2026</p>

<h2>1. Información que recopilamos</h2>
<p>Recopilamos información de contacto empresarial (nombre, teléfono, correo electrónico) con el fin de gestionar relaciones comerciales a través de WhatsApp Business API y Kommo CRM.</p>

<h2>2. Uso de la información</h2>
<p>La información recopilada se utiliza exclusivamente para comunicaciones comerciales autorizadas, seguimiento de consultas y automatización de procesos internos de ventas.</p>

<h2>3. WhatsApp Business API</h2>
<p>Utilizamos la API de WhatsApp Business de Meta para enviar y recibir mensajes comerciales. Los datos de mensajes se almacenan de forma segura en servidores propios y no se comparten con terceros.</p>

<h2>4. Seguridad</h2>
<p>Implementamos medidas de seguridad técnicas y organizativas para proteger la información personal contra acceso no autorizado, pérdida o divulgación.</p>

<h2>5. Contacto</h2>
<p>Para consultas sobre privacidad: <a href="mailto:info@indumentariasegura.com.ar">info@indumentariasegura.com.ar</a></p>
<p>Sitio web: <a href="https://indumentariasegura.com.ar">https://indumentariasegura.com.ar</a></p>
</body>
</html>"""
