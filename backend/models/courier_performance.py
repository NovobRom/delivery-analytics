from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID


class CourierPerformanceBase(BaseModel):
    """Base fields for courier performance record."""
    report_date: date
    courier_name: str
    car_number: Optional[str] = None
    department: Optional[str] = None
    reports_count: int = Field(default=0, ge=0)
    addresses_count: int = Field(default=0, ge=0)
    loaded_parcels: int = Field(default=0, ge=0)
    delivered_parcels: int = Field(default=0, ge=0)
    delivered_in_hand: int = Field(default=0, ge=0)
    delivered_safe_place: int = Field(default=0, ge=0)
    undelivered_parcels: int = Field(default=0, ge=0)
    undelivered_with_reason: int = Field(default=0, ge=0)
    undelivered_no_reason: int = Field(default=0, ge=0)
    delivery_success_rate: float = Field(default=0.0, ge=0, le=100)


class CourierPerformanceCreate(CourierPerformanceBase):
    """Fields for creating a new courier performance record."""
    import_batch_id: Optional[UUID] = None


class CourierPerformanceUpdate(BaseModel):
    """Fields for updating courier performance (all optional)."""
    report_date: Optional[date] = None
    courier_name: Optional[str] = None
    car_number: Optional[str] = None
    department: Optional[str] = None
    reports_count: Optional[int] = Field(None, ge=0)
    addresses_count: Optional[int] = Field(None, ge=0)
    loaded_parcels: Optional[int] = Field(None, ge=0)
    delivered_parcels: Optional[int] = Field(None, ge=0)
    delivered_in_hand: Optional[int] = Field(None, ge=0)
    delivered_safe_place: Optional[int] = Field(None, ge=0)
    undelivered_parcels: Optional[int] = Field(None, ge=0)
    undelivered_with_reason: Optional[int] = Field(None, ge=0)
    undelivered_no_reason: Optional[int] = Field(None, ge=0)
    delivery_success_rate: Optional[float] = Field(None, ge=0, le=100)


class CourierPerformanceResponse(CourierPerformanceBase):
    """Courier performance response with all fields."""
    id: UUID
    import_batch_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CourierPerformanceImport(BaseModel):
    """Single record for bulk import from Excel."""
    report_date: date
    courier_name: str
    car_number: Optional[str] = None
    department: Optional[str] = None
    reports_count: int = 0
    addresses_count: int = 0
    loaded_parcels: int = 0
    delivered_parcels: int = 0
    delivered_in_hand: int = 0
    delivered_safe_place: int = 0
    undelivered_parcels: int = 0
    undelivered_with_reason: int = 0
    undelivered_no_reason: int = 0
    delivery_success_rate: float = 0.0


class CourierPerformanceBulkImport(BaseModel):
    """Bulk import request."""
    records: list[CourierPerformanceImport]
    filename: Optional[str] = None
