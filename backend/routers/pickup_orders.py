from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date
from uuid import uuid4

from ..supabase_client import supabase
from ..models import (
    PickupOrderCreate,
    PickupOrderUpdate,
    PickupOrderResponse,
    PickupOrderBulkImport,
    ImportSummary,
    FileType,
    ImportStatus,
)

router = APIRouter(prefix="/pickup-orders", tags=["Pickup Orders"])


@router.get("/", response_model=list[PickupOrderResponse])
async def get_all_orders(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sender_country: Optional[str] = None,
    recipient_country: Optional[str] = None,
    status: Optional[str] = None,
    courier_name: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
):
    """Get all pickup orders with optional filters."""
    query = supabase.from_("pickup_orders").select("*")

    if date_from:
        query = query.gte("execution_date", date_from.isoformat())
    if date_to:
        query = query.lte("execution_date", date_to.isoformat())
    if sender_country:
        query = query.ilike("sender_country", f"%{sender_country}%")
    if recipient_country:
        query = query.ilike("recipient_country", f"%{recipient_country}%")
    if status:
        query = query.ilike("shipment_status", f"%{status}%")
    if courier_name:
        query = query.ilike("courier_name", f"%{courier_name}%")

    query = query.order("execution_date", desc=True).range(offset, offset + limit - 1)

    result = query.execute()
    return result.data


@router.get("/{order_id}", response_model=PickupOrderResponse)
async def get_order(order_id: str):
    """Get a single pickup order by ID."""
    result = supabase.from_("pickup_orders").select("*").eq("id", order_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    return result.data


@router.post("/", response_model=PickupOrderResponse, status_code=201)
async def create_order(order: PickupOrderCreate):
    """Create a new pickup order."""
    result = supabase.from_("pickup_orders").insert(order.model_dump(mode="json")).execute()
    return result.data[0]


@router.put("/{order_id}", response_model=PickupOrderResponse)
async def update_order(order_id: str, order: PickupOrderUpdate):
    """Update an existing pickup order."""
    update_data = order.model_dump(exclude_unset=True, mode="json")

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.from_("pickup_orders").update(update_data).eq("id", order_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    return result.data[0]


@router.delete("/{order_id}", status_code=204)
async def delete_order(order_id: str):
    """Delete a pickup order."""
    result = supabase.from_("pickup_orders").delete().eq("id", order_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")


@router.post("/bulk-import", response_model=ImportSummary)
async def bulk_import(data: PickupOrderBulkImport):
    """Bulk import pickup orders from Excel."""
    batch_id = uuid4()
    errors = []
    imported = 0

    # Create import log
    log_data = {
        "id": str(batch_id),
        "filename": data.filename or "unknown",
        "file_type": FileType.PICKUP.value,
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
            result = supabase.from_("pickup_orders").insert(records_to_insert).execute()
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
        file_type=FileType.PICKUP,
        total_records=len(data.records),
        imported=imported,
        failed=len(errors),
        status=ImportStatus.COMPLETED if not errors else ImportStatus.FAILED,
        errors=errors,
    )


@router.delete("/batch/{batch_id}", status_code=204)
async def delete_batch(batch_id: str):
    """Delete all orders from a specific import batch."""
    supabase.from_("pickup_orders").delete().eq("import_batch_id", batch_id).execute()


@router.get("/stats/summary")
async def get_summary_stats(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """Get summary statistics for pickup orders."""
    query = supabase.from_("pickup_orders").select("*")

    if date_from:
        query = query.gte("execution_date", date_from.isoformat())
    if date_to:
        query = query.lte("execution_date", date_to.isoformat())

    result = query.execute()
    data = result.data

    if not data:
        return {
            "total_orders": 0,
            "total_shipments": 0,
            "total_weight_kg": 0,
            "total_revenue": 0,
            "unique_countries": 0,
        }

    total_shipments = sum(r.get("shipments_in_doc", 1) for r in data)
    total_weight = sum(r.get("actual_weight", 0) or 0 for r in data)
    total_revenue = sum(r.get("delivery_cost", 0) or 0 for r in data)

    sender_countries = set(r.get("sender_country") for r in data if r.get("sender_country"))
    recipient_countries = set(r.get("recipient_country") for r in data if r.get("recipient_country"))
    unique_countries = len(sender_countries | recipient_countries)

    return {
        "total_orders": len(data),
        "total_shipments": total_shipments,
        "total_weight_kg": round(total_weight, 2),
        "total_revenue": round(total_revenue, 2),
        "unique_countries": unique_countries,
    }


@router.get("/stats/by-country")
async def get_stats_by_country(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    direction: str = Query(default="recipient", regex="^(sender|recipient)$"),
):
    """Get statistics grouped by country."""
    query = supabase.from_("pickup_orders").select("*")

    if date_from:
        query = query.gte("execution_date", date_from.isoformat())
    if date_to:
        query = query.lte("execution_date", date_to.isoformat())

    result = query.execute()
    data = result.data

    country_field = f"{direction}_country"
    country_stats = {}

    for record in data:
        country = record.get(country_field) or "Unknown"
        if country not in country_stats:
            country_stats[country] = {
                "country": country,
                "orders_count": 0,
                "shipments_count": 0,
                "total_weight": 0,
                "total_revenue": 0,
            }
        country_stats[country]["orders_count"] += 1
        country_stats[country]["shipments_count"] += record.get("shipments_in_doc", 1)
        country_stats[country]["total_weight"] += record.get("actual_weight", 0) or 0
        country_stats[country]["total_revenue"] += record.get("delivery_cost", 0) or 0

    # Sort by orders count
    sorted_stats = sorted(country_stats.values(), key=lambda x: x["orders_count"], reverse=True)

    return sorted_stats


@router.get("/stats/by-status")
async def get_stats_by_status(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """Get statistics grouped by shipment status."""
    query = supabase.from_("pickup_orders").select("*")

    if date_from:
        query = query.gte("execution_date", date_from.isoformat())
    if date_to:
        query = query.lte("execution_date", date_to.isoformat())

    result = query.execute()
    data = result.data

    status_stats = {}
    for record in data:
        status = record.get("shipment_status") or "Unknown"
        if status not in status_stats:
            status_stats[status] = {
                "status": status,
                "count": 0,
                "percentage": 0,
            }
        status_stats[status]["count"] += 1

    total = len(data)
    for status in status_stats.values():
        status["percentage"] = round((status["count"] / total) * 100, 2) if total > 0 else 0

    return list(status_stats.values())
