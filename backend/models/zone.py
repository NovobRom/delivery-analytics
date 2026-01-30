from datetime import datetime
from pydantic import BaseModel, Field


class ZoneBase(BaseModel):
    """Base zone fields."""
    name: str = Field(..., min_length=2, max_length=255)


class ZoneCreate(ZoneBase):
    """Fields for creating a new zone."""
    pass


class ZoneResponse(ZoneBase):
    """Zone response with all fields."""
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
