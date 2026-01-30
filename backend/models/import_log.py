from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
from uuid import UUID
from enum import Enum


class FileType(str, Enum):
    DELIVERY = "delivery"
    PICKUP = "pickup"


class ImportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportLogBase(BaseModel):
    """Base fields for import log."""
    filename: str
    file_type: FileType
    records_count: int = Field(default=0, ge=0)
    records_imported: int = Field(default=0, ge=0)
    records_failed: int = Field(default=0, ge=0)
    status: ImportStatus = ImportStatus.PENDING
    errors: list[dict[str, Any]] = []


class ImportLogCreate(ImportLogBase):
    """Fields for creating a new import log."""
    pass


class ImportLogUpdate(BaseModel):
    """Fields for updating import log."""
    records_imported: Optional[int] = None
    records_failed: Optional[int] = None
    status: Optional[ImportStatus] = None
    errors: Optional[list[dict[str, Any]]] = None
    completed_at: Optional[datetime] = None


class ImportLogResponse(ImportLogBase):
    """Import log response with all fields."""
    id: UUID
    imported_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportSummary(BaseModel):
    """Summary of import operation."""
    batch_id: UUID
    filename: str
    file_type: FileType
    total_records: int
    imported: int
    failed: int
    status: ImportStatus
    errors: list[str] = []
    duration_ms: Optional[int] = None
