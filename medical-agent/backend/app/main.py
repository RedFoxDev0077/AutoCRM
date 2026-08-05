import os
import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.routers import auth, portal, studies, chat

app = FastAPI(title="Medical Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PUBLIC_PATHS = {"/api/auth/login", "/health"}


@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
        return await call_next(request)
    if request.url.path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        try:
            jwt.decode(auth_header.split(" ")[1], get_settings().JWT_SECRET, algorithms=["HS256"])
        except Exception:
            return JSONResponse({"detail": "Token inválido o expirado"}, status_code=401)
    return await call_next(request)


app.include_router(auth.router, prefix="/api")
app.include_router(portal.router, prefix="/api")
app.include_router(studies.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    os.makedirs(get_settings().STUDIES_DIR, exist_ok=True)
