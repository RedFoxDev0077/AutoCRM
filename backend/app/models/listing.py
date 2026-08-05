from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, Text, Float
from sqlalchemy.sql import func
from app.database import Base
import enum


class ListingStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    synced = "synced"


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    ml_id = Column(String(50), unique=True, index=True)
    title = Column(String(300))
    description = Column(Text, nullable=True)
    original_title = Column(String(300))
    original_description = Column(Text, nullable=True)
    ai_suggested_title = Column(String(300), nullable=True)
    ai_suggested_description = Column(Text, nullable=True)
    ai_improvements = Column(Text, nullable=True)
    status = Column(SAEnum(ListingStatus), default=ListingStatus.synced)
    price = Column(Float, default=0)
    available_quantity = Column(Integer, default=0, nullable=True)
    category_id = Column(String(50), nullable=True)
    thumbnail = Column(String(500), nullable=True)
    permalink = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
