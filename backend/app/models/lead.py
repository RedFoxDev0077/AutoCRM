from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class LeadSource(str, enum.Enum):
    google_maps = "google_maps"
    kommo = "kommo"
    google_ads = "google_ads"
    mercadolibre = "mercadolibre"


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    responded = "responded"
    converted = "converted"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(30), unique=True, index=True)
    name = Column(String(200))
    address = Column(String(500))
    business_name = Column(String(200))
    source = Column(SAEnum(LeadSource), default=LeadSource.google_maps)
    status = Column(SAEnum(LeadStatus), default=LeadStatus.new)
    kommo_lead_id = Column(String(50), nullable=True)
    google_place_id = Column(String(100), nullable=True)
    notes = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
