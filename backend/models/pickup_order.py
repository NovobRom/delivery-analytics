from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID


class PickupOrderBase(BaseModel):
    """Base fields for pickup order record."""
    # Document info
    pickup_doc_number: Optional[str] = None
    shipments_in_doc: int = Field(default=1, ge=0)
    execution_date: Optional[date] = None
    time_interval: Optional[str] = None
    creation_source: Optional[str] = None
    first_warehouse: Optional[str] = None

    # Shipment info
    shipment_number: Optional[str] = None
    places_count: int = Field(default=1, ge=0)
    shipment_created_date: Optional[date] = None
    shipment_department: Optional[str] = None
    first_scan_date: Optional[date] = None
    first_scan_warehouse: Optional[str] = None
    planned_delivery_date: Optional[date] = None

    # Sender info
    sender_country: Optional[str] = None
    sender_type: Optional[str] = None
    sender_company: Optional[str] = None
    sender_city: Optional[str] = None
    sender_address: Optional[str] = None

    # Shipment details
    shipment_type: Optional[str] = None
    shipment_description: Optional[str] = None
    declared_value: Optional[float] = Field(None, ge=0)
    actual_weight: Optional[float] = Field(None, ge=0)
    volumetric_weight: Optional[float] = Field(None, ge=0)
    dimensions: Optional[str] = None

    # Recipient info
    recipient_country: Optional[str] = None
    recipient_type: Optional[str] = None

    # Status info
    pickup_status: Optional[str] = None
    pickup_status_date: Optional[date] = None
    courier_name: Optional[str] = None

    # Partner info
    partner_pickup_number: Optional[str] = None
    partner_shipment_number: Optional[str] = None

    # Payment info
    delivery_cost: Optional[float] = Field(None, ge=0)
    delivery_currency: str = "UAH"
    payer: Optional[str] = None
    payment_doc_number: Optional[str] = None
    payment_doc_status: Optional[str] = None
    payment_doc_status_date: Optional[date] = None
    shipment_payment_status: Optional[str] = None
    shipment_payment_date: Optional[date] = None

    # Final status
    shipment_status: Optional[str] = None
    shipment_status_date: Optional[date] = None
    verification_result: Optional[str] = None
    acceptance_date: Optional[date] = None
    last_scan_date: Optional[date] = None
    last_scan_department: Optional[str] = None
    last_scan_report: Optional[str] = None

    # Performance
    execution_speed: Optional[str] = None
    non_execution_reason: Optional[str] = None


class PickupOrderCreate(PickupOrderBase):
    """Fields for creating a new pickup order."""
    import_batch_id: Optional[UUID] = None


class PickupOrderUpdate(BaseModel):
    """Fields for updating pickup order (all optional)."""
    pickup_doc_number: Optional[str] = None
    shipments_in_doc: Optional[int] = None
    execution_date: Optional[date] = None
    shipment_number: Optional[str] = None
    sender_country: Optional[str] = None
    recipient_country: Optional[str] = None
    pickup_status: Optional[str] = None
    shipment_status: Optional[str] = None
    delivery_cost: Optional[float] = None
    actual_weight: Optional[float] = None


class PickupOrderResponse(PickupOrderBase):
    """Pickup order response with all fields."""
    id: UUID
    import_batch_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PickupOrderImport(BaseModel):
    """Single record for bulk import from Excel."""
    pickup_doc_number: Optional[str] = None
    shipments_in_doc: int = 1
    execution_date: Optional[date] = None
    time_interval: Optional[str] = None
    creation_source: Optional[str] = None
    first_warehouse: Optional[str] = None
    shipment_number: Optional[str] = None
    places_count: int = 1
    shipment_created_date: Optional[date] = None
    sender_country: Optional[str] = None
    sender_type: Optional[str] = None
    sender_company: Optional[str] = None
    sender_city: Optional[str] = None
    shipment_type: Optional[str] = None
    declared_value: Optional[float] = None
    actual_weight: Optional[float] = None
    volumetric_weight: Optional[float] = None
    dimensions: Optional[str] = None
    recipient_country: Optional[str] = None
    recipient_type: Optional[str] = None
    pickup_status: Optional[str] = None
    courier_name: Optional[str] = None
    delivery_cost: Optional[float] = None
    delivery_currency: str = "UAH"
    payer: Optional[str] = None
    shipment_status: Optional[str] = None
    execution_speed: Optional[str] = None
    non_execution_reason: Optional[str] = None


class PickupOrderBulkImport(BaseModel):
    """Bulk import request."""
    records: list[PickupOrderImport]
    filename: Optional[str] = None
