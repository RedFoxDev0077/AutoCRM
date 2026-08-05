from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.message import MessageDirection, MessageStatus


class SendMessageRequest(BaseModel):
    phone: str
    message: str


class SendTemplateRequest(BaseModel):
    phone: str
    template_name: str
    language: str = "es_AR"
    params: list[str] = []


class MessageResponse(BaseModel):
    id: int
    phone: str
    direction: MessageDirection
    content: str
    template_name: Optional[str] = None
    status: MessageStatus
    created_at: datetime

    class Config:
        from_attributes = True
