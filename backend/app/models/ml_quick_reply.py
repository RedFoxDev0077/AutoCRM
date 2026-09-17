from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class MLQuickReply(Base):
    """A saved answer for Mercado Libre questions that keep coming back (stock, talles, envíos...)."""
    __tablename__ = "ml_quick_replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(60), nullable=False)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    usos: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
