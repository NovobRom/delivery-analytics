from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class DeliveryBase(BaseModel):
    """Base delivery fields."""
    delivery_date: date
    loaded_count: int = Field(..., ge=0)
    delivered_count: int = Field(..., ge=0)

    @field_validator("delivered_count")
    @classmethod
    def delivered_not_more_than_loaded(cls, v, info):
        loaded = info.data.get("loaded_count", 0)
        if v > loaded:
            raise ValueError("delivered_count cannot exceed loaded_count")
        return v


class DeliveryCreate(DeliveryBase):
    """Fields for creating a new delivery."""
    courier_id: str
    zone_id: str


class DeliveryUpdate(BaseModel):
    """Fields for updating a delivery (all optional)."""
    delivery_date: Optional[date] = None
    courier_id: Optional[str] = None
    zone_id: Optional[str] = None
    loaded_count: Optional[int] = Field(None, ge=0)
    delivered_count: Optional[int] = Field(None, ge=0)


class DeliveryResponse(DeliveryBase):
    """Delivery response with all fields."""
    id: str
    courier_id: Optional[str]
    zone_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryWithDetails(DeliveryResponse):
    """Delivery response with courier and zone details."""
    courier_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    zone_name: Optional[str] = None
    success_rate: float = 0.0


class DeliveryImport(BaseModel):
    """Single delivery record for bulk import."""
    delivery_date: date
    courier_name: str
    vehicle_number: Optional[str] = None
    zone_name: str
    loaded_count: int = Field(..., ge=0)
    delivered_count: int = Field(..., ge=0)


class ImportResult(BaseModel):
    """Result of bulk import operation."""
    success: bool
    total_records: int
    imported_records: int
    skipped_records: int
    errors: list[str] = []
