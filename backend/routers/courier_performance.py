from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date
from uuid import uuid4

from ..supabase_client import supabase
from ..models import (
    CourierPerformanceCreate,
    CourierPerformanceUpdate,
    CourierPerformanceResponse,
    CourierPerformanceBulkImport,
    ImportSummary,
    FileType,
    ImportStatus,
)

router = APIRouter(prefix="/courier-performance", tags=["Courier Performance"])


@router.get("/", response_model=list[CourierPerformanceResponse])
async def get_all_records(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    courier_name: Optional[str] = None,
    department: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
):
    """Get all courier performance records with optional filters."""
    query = supabase.from_("courier_performance").select("*")

    if date_from:
        query = query.gte("report_date", date_from.isoformat())
    if date_to:
        query = query.lte("report_date", date_to.isoformat())
    if courier_name:
        query = query.ilike("courier_name", f"%{courier_name}%")
    if department:
        query = query.ilike("department", f"%{department}%")

    query = query.order("report_date", desc=True).range(offset, offset + limit - 1)

    result = query.execute()
    return result.data


@router.get("/{record_id}", response_model=CourierPerformanceResponse)
async def get_record(record_id: str):
    """Get a single courier performance record by ID."""
    result = supabase.from_("courier_performance").select("*").eq("id", record_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")

    return result.data


@router.post("/", response_model=CourierPerformanceResponse, status_code=201)
async def create_record(record: CourierPerformanceCreate):
    """Create a new courier performance record."""
    result = supabase.from_("courier_performance").insert(record.model_dump(mode="json")).execute()
    return result.data[0]


@router.put("/{record_id}", response_model=CourierPerformanceResponse)
async def update_record(record_id: str, record: CourierPerformanceUpdate):
    """Update an existing courier performance record."""
    update_data = record.model_dump(exclude_unset=True, mode="json")

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.from_("courier_performance").update(update_data).eq("id", record_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")

    return result.data[0]


@router.delete("/{record_id}", status_code=204)
async def delete_record(record_id: str):
    """Delete a courier performance record."""
    result = supabase.from_("courier_performance").delete().eq("id", record_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")


@router.post("/bulk-import", response_model=ImportSummary)
async def bulk_import(data: CourierPerformanceBulkImport):
    """Bulk import courier performance records from Excel."""
    batch_id = uuid4()
    errors = []
    imported = 0

    # Create import log
    log_data = {
        "id": str(batch_id),
        "filename": data.filename or "unknown",
        "file_type": FileType.DELIVERY.value,
        "records_count": len(data.records),
        "status": ImportStatus.PROCESSING.value,
    }
    supabase.from_("import_logs").insert(log_data).execute()

    # Prepare records for insert
    records_to_insert = []
    for i, record in enumerate(data.records):
        try:
            record_dict = record.model_dump(mode="json")
            record_dict["import_batch_id"] = str(batch_id)
            records_to_insert.append(record_dict)
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    # Bulk insert
    if records_to_insert:
        try:
            result = supabase.from_("courier_performance").insert(records_to_insert).execute()
            imported = len(result.data)
        except Exception as e:
            errors.append(f"Bulk insert error: {str(e)}")

    # Update import log
    supabase.from_("import_logs").update({
        "records_imported": imported,
        "records_failed": len(errors),
        "status": ImportStatus.COMPLETED.value if not errors else ImportStatus.FAILED.value,
        "errors": [{"message": e} for e in errors],
    }).eq("id", str(batch_id)).execute()

    return ImportSummary(
        batch_id=batch_id,
        filename=data.filename or "unknown",
        file_type=FileType.DELIVERY,
        total_records=len(data.records),
        imported=imported,
        failed=len(errors),
        status=ImportStatus.COMPLETED if not errors else ImportStatus.FAILED,
        errors=errors,
    )


@router.delete("/batch/{batch_id}", status_code=204)
async def delete_batch(batch_id: str):
    """Delete all records from a specific import batch."""
    supabase.from_("courier_performance").delete().eq("import_batch_id", batch_id).execute()


@router.get("/stats/summary")
async def get_summary_stats(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """Get summary statistics for courier performance."""
    query = supabase.from_("courier_performance").select("*")

    if date_from:
        query = query.gte("report_date", date_from.isoformat())
    if date_to:
        query = query.lte("report_date", date_to.isoformat())

    result = query.execute()
    data = result.data

    if not data:
        return {
            "total_records": 0,
            "unique_couriers": 0,
            "total_delivered": 0,
            "total_loaded": 0,
            "avg_success_rate": 0,
        }

    unique_couriers = len(set(r["courier_name"] for r in data))
    total_delivered = sum(r.get("delivered_parcels", 0) for r in data)
    total_loaded = sum(r.get("loaded_parcels", 0) for r in data)
    avg_success_rate = sum(r.get("delivery_success_rate", 0) for r in data) / len(data) if data else 0

    return {
        "total_records": len(data),
        "unique_couriers": unique_couriers,
        "total_delivered": total_delivered,
        "total_loaded": total_loaded,
        "avg_success_rate": round(avg_success_rate, 2),
    }


@router.get("/stats/top-couriers")
async def get_top_couriers(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 10,
):
    """Get top performing couriers."""
    query = supabase.from_("courier_performance").select("*")

    if date_from:
        query = query.gte("report_date", date_from.isoformat())
    if date_to:
        query = query.lte("report_date", date_to.isoformat())

    result = query.execute()
    data = result.data

    # Aggregate by courier
    courier_stats = {}
    for record in data:
        name = record["courier_name"]
        if name not in courier_stats:
            courier_stats[name] = {
                "courier_name": name,
                "total_delivered": 0,
                "total_loaded": 0,
                "records_count": 0,
                "sum_success_rate": 0,
            }
        courier_stats[name]["total_delivered"] += record.get("delivered_parcels", 0)
        courier_stats[name]["total_loaded"] += record.get("loaded_parcels", 0)
        courier_stats[name]["records_count"] += 1
        courier_stats[name]["sum_success_rate"] += record.get("delivery_success_rate", 0)

    # Calculate averages and sort
    top_couriers = []
    for name, stats in courier_stats.items():
        avg_rate = stats["sum_success_rate"] / stats["records_count"] if stats["records_count"] > 0 else 0
        top_couriers.append({
            "courier_name": name,
            "total_delivered": stats["total_delivered"],
            "total_loaded": stats["total_loaded"],
            "avg_success_rate": round(avg_rate, 2),
        })

    top_couriers.sort(key=lambda x: x["avg_success_rate"], reverse=True)
    return top_couriers[:limit]
