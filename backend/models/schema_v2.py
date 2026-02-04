from datetime import date, time
from typing import Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime

class ShipmentImport(BaseModel):
    # Key Identifier
    shipment_number: str

    # Pickup Details
    pickup_doc_number: Optional[str] = None
    pickup_shipment_count: int = 0
    pickup_execution_date: Optional[date] = None
    pickup_time_slot: Optional[str] = None

    # Sender Details
    sender_country: Optional[str] = None
    sender_type: Optional[str] = None
    sender_company: Optional[str] = None
    sender_city: Optional[str] = None

    # Shipment Specs
    shipment_type: Optional[str] = None
    declared_value: Optional[float] = 0.0
    total_weight_actual: Optional[float] = 0.0
    total_weight_volumetric: Optional[float] = 0.0
    dimensions: Optional[str] = None
    places_count: int = 1

    # Receiver Details
    receiver_country: Optional[str] = None
    receiver_type: Optional[str] = None

    # Financials & Status
    delivery_cost: Optional[float] = 0.0
    payer_type: Optional[str] = None
    payment_status: Optional[str] = None
    
    last_shipment_status: Optional[str] = None
    last_shipment_status_date: Optional[date] = None
    execution_speed: Optional[str] = None

    @validator('shipment_number')
    def validate_shipment_number(cls, v):
        if not v:
            raise ValueError('Shipment number is required')
        return str(v).strip()

class DeliveryEventImport(BaseModel):
    # Link to Shipment
    shipment_number: str
    
    # Delivery Run Details
    report_date: date
    courier_name: Optional[str] = None
    car_number: Optional[str] = None
    loading_sheet_number: Optional[str] = None
    branch: Optional[str] = None
    
    # Shipment State at Event
    shipment_created_date: Optional[date] = None
    last_warehouse: Optional[str] = None
    planned_arrival_date: Optional[date] = None
    
    # Delivery Specifics
    receiver_city: Optional[str] = None
    receiver_address: Optional[str] = None
    district: Optional[str] = None
    
    # Operations
    status_on_date: Optional[str] = None
    delivery_status_on_date: Optional[str] = None
    delivery_date: Optional[date] = None
    delivery_time: Optional[time] = None
    predict_window: Optional[str] = None
    failure_reason: Optional[str] = None
    delivery_type: Optional[str] = None
    
    is_duplicate: bool = False

    @validator('shipment_number')
    def validate_shipment_number(cls, v):
        if not v:
            raise ValueError('Shipment number is required (Foreign Key)')
        return str(v).strip()
