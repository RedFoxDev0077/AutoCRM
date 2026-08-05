from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.lead import LeadSource, LeadStatus


class LeadBase(BaseModel):
    phone: str
    name: str
    address: Optional[str] = None
    business_name: Optional[str] = None
    source: LeadSource = LeadSource.google_maps


class LeadCreate(LeadBase):
    google_place_id: Optional[str] = None


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    kommo_lead_id: Optional[str] = None


class LeadResponse(LeadBase):
    id: int
    status: LeadStatus
    kommo_lead_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadSearchRequest(BaseModel):
    query: str
    location: str
    radius_km: int = 10
