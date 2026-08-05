from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.listing import ListingStatus


class ListingResponse(BaseModel):
    id: int
    ml_id: str
    title: str
    description: Optional[str] = None
    original_title: str
    original_description: Optional[str] = None
    ai_suggested_title: Optional[str] = None
    ai_suggested_description: Optional[str] = None
    ai_improvements: Optional[str] = None
    status: ListingStatus
    price: float
    available_quantity: Optional[int] = None
    category_id: Optional[str] = None
    thumbnail: Optional[str] = None
    permalink: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
