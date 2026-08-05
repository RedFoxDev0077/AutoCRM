import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.claude_service import chat
from app.config import get_settings

router = APIRouter(prefix="/chat", tags=["chat"])
settings = get_settings()

HISTORY_FILE = "/data/studies/_chat_history.json"


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@router.post("")
async def chat_endpoint(req: ChatRequest):
    if not settings.CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="CLAUDE_API_KEY no configurada")
    try:
        msgs = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = await chat(msgs, settings.STUDIES_DIR)

        # Persist full history to server after every message
        full = msgs + [{"role": "assistant", "content": reply}]
        os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(full, f, ensure_ascii=False)

        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_history():
    try:
        if os.path.isfile(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return []


@router.delete("/history")
def clear_history():
    try:
        if os.path.isfile(HISTORY_FILE):
            os.remove(HISTORY_FILE)
    except Exception:
        pass
    return {"ok": True}
