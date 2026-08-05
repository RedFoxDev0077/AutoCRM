from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, Text
from sqlalchemy.sql import func
from app.database import Base
import enum


class MessageDirection(str, enum.Enum):
    inbound = "in"
    outbound = "out"


class MessageStatus(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"
    received = "received"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(30), index=True)
    direction = Column(SAEnum(MessageDirection))
    content = Column(Text)
    template_name = Column(String(100), nullable=True)
    wa_message_id = Column(String(100), nullable=True)
    status = Column(SAEnum(MessageStatus), default=MessageStatus.sent)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
