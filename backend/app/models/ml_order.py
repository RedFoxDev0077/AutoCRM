from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class MLOrder(Base):
    __tablename__ = "ml_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    ml_order_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="paid")
    total_amount: Mapped[float] = mapped_column(Float, default=0)
    title: Mapped[str] = mapped_column(Text, default="")
    item_id: Mapped[str] = mapped_column(String(32), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    buyer_nickname: Mapped[str] = mapped_column(String(128), default="")
    order_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
