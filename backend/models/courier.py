from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CourierBase(BaseModel):
    """Base courier fields."""
    full_name: str = Field(..., min_length=2, max_length=255)
    vehicle_number: Optional[str] = Field(None, max_length=50)


class CourierCreate(CourierBase):
    """Fields for creating a new courier."""
    is_active: bool = True


class CourierUpdate(BaseModel):
    """Fields for updating a courier (all optional)."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    vehicle_number: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class CourierResponse(CourierBase):
    """Courier response with all fields."""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
