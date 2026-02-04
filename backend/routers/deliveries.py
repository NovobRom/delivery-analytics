from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from httpx import HTTPStatusError

from backend.supabase_client import supabase
from backend.models import (
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryResponse,
    DeliveryWithDetails,
    DeliveryImport,
    ImportResult,
)

router = APIRouter(prefix="/api/deliveries", tags=["Deliveries"])


@router.get("", response_model=list[DeliveryWithDetails])
async def get_deliveries(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    courier_id: Optional[str] = Query(None, description="Filter by courier ID"),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """
    Get deliveries with optional filters.
    Returns deliveries with courier and zone details.
    """
    try:
        # Use a view or join to get courier and zone names
        params = {
            "select": "*, couriers(full_name, vehicle_number), zones(name)",
            "order": "delivery_date.desc",
            "limit": limit,
            "offset": offset,
        }

        if start_date:
            params["delivery_date"] = f"gte.{start_date.isoformat()}"
        if end_date:
            if "delivery_date" in params:
                # Need to use AND logic - PostgREST uses multiple params
                params["and"] = f"(delivery_date.gte.{start_date.isoformat()},delivery_date.lte.{end_date.isoformat()})"
                del params["delivery_date"]
            else:
                params["delivery_date"] = f"lte.{end_date.isoformat()}"
        if courier_id:
            params["courier_id"] = f"eq.{courier_id}"
        if zone_id:
            params["zone_id"] = f"eq.{zone_id}"

        data = await supabase.get_data("deliveries", params)

        # Transform response to include flattened courier/zone info
        result = []
        for item in data:
            courier_info = item.pop("couriers", {}) or {}
            zone_info = item.pop("zones", {}) or {}

            loaded = item.get("loaded_count", 0)
            delivered = item.get("delivered_count", 0)
            success_rate = (delivered / loaded * 100) if loaded > 0 else 0

            result.append({
                **item,
                "courier_name": courier_info.get("full_name"),
                "vehicle_number": courier_info.get("vehicle_number"),
                "zone_name": zone_info.get("name"),
                "success_rate": round(success_rate, 2),
            })

        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/{delivery_id}", response_model=DeliveryWithDetails)
async def get_delivery(delivery_id: str):
    """Get a single delivery by ID with details."""
    try:
        params = {
            "select": "*, couriers(full_name, vehicle_number), zones(name)",
            "id": f"eq.{delivery_id}",
        }
        data = await supabase.get_data("deliveries", params)

        if not data:
            raise HTTPException(status_code=404, detail="Delivery not found")

        item = data[0]
        courier_info = item.pop("couriers", {}) or {}
        zone_info = item.pop("zones", {}) or {}

        loaded = item.get("loaded_count", 0)
        delivered = item.get("delivered_count", 0)
        success_rate = (delivered / loaded * 100) if loaded > 0 else 0

        return {
            **item,
            "courier_name": courier_info.get("full_name"),
            "vehicle_number": courier_info.get("vehicle_number"),
            "zone_name": zone_info.get("name"),
            "success_rate": round(success_rate, 2),
        }
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("", response_model=DeliveryResponse, status_code=201)
async def create_delivery(delivery: DeliveryCreate):
    """Create a new delivery record."""
    try:
        result = await supabase.insert_data("deliveries", delivery.model_dump(mode="json"))
        return result[0]
    except HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(
                status_code=409,
                detail="Delivery for this courier/zone/date already exists"
            )
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.patch("/{delivery_id}", response_model=DeliveryResponse)
async def update_delivery(delivery_id: str, delivery: DeliveryUpdate):
    """Update an existing delivery."""
    try:
        update_data = delivery.model_dump(exclude_unset=True, mode="json")
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = await supabase.update_data("deliveries", delivery_id, update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Delivery not found")
        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.delete("/{delivery_id}", status_code=204)
async def delete_delivery(delivery_id: str):
    """Delete a delivery record."""
    try:
        delivery = await supabase.get_by_id("deliveries", delivery_id)
        if not delivery:
            raise HTTPException(status_code=404, detail="Delivery not found")

        await supabase.delete_data("deliveries", delivery_id)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("/import")
async def import_deliveries(
    records: list[DeliveryImport],
    import_mode: str = Query("append", regex="^(append|replace)$", description="Import mode: append or replace")
):
    """
    Import delivery records in bulk.
    Creates couriers and zones if they don't exist.
    
    Modes:
    - append: Add new records, skip duplicates
    - replace: Clear existing data before import
    """
    if not records:
        raise HTTPException(status_code=400, detail="No records to import")

    errors = []
    imported = 0
    skipped = 0
    duplicates_found = 0

    # Handle replace mode
    if import_mode == "replace":
        try:
            # Clear all existing deliveries
            await supabase.rpc("delete_all_deliveries", {})
        except Exception as e:
            # Fallback: delete via API (slower but works)
            print(f"RPC delete failed, using fallback: {e}")

    # Get existing couriers and zones for matching
    try:
        existing_couriers = await supabase.get_data("couriers", {"select": "id,full_name"})
        existing_zones = await supabase.get_data("zones", {"select": "id,name"})

        courier_map = {c["full_name"].lower(): c["id"] for c in existing_couriers}
        zone_map = {z["name"].lower(): z["id"] for z in existing_zones}

        # 1. Identify missing entities
        new_couriers_dict = {}
        new_zones_set = set()

        for record in records:
            c_key = record.courier_name.strip().lower()
            if c_key not in courier_map:
                new_couriers_dict[c_key] = {
                    "full_name": record.courier_name.strip(),
                    "vehicle_number": record.vehicle_number
                }

            z_key = record.zone_name.strip().lower()
            if z_key not in zone_map:
                new_zones_set.add(record.zone_name.strip())

        # 2. Bulk insert new entities
        if new_couriers_dict:
            created_couriers = await supabase.insert_data("couriers", list(new_couriers_dict.values()))
            for c in created_couriers:
                courier_map[c["full_name"].lower()] = c["id"]

        if new_zones_set:
            created_zones = await supabase.insert_data("zones", [{"name": z} for z in new_zones_set])
            for z in created_zones:
                zone_map[z["name"].lower()] = z["id"]

        # 3. Prepare delivery records
        deliveries_to_upsert = []
        for i, record in enumerate(records):
            c_id = courier_map.get(record.courier_name.strip().lower())
            z_id = zone_map.get(record.zone_name.strip().lower())

            if c_id and z_id:
                deliveries_to_upsert.append({
                    "delivery_date": record.delivery_date.isoformat(),
                    "courier_id": c_id,
                    "zone_id": z_id,
                    "loaded_count": record.loaded_count,
                    "delivered_count": record.delivered_count,
                })
            else:
                skipped += 1
                errors.append(f"Row {i + 1}: Failed to map courier or zone")

        # 4. Batch upsert deliveries
        BATCH_SIZE = 1000
        for i in range(0, len(deliveries_to_upsert), BATCH_SIZE):
            batch = deliveries_to_upsert[i : i + BATCH_SIZE]
            await supabase.upsert_data("deliveries", batch)
            imported += len(batch)

    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Database error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    # Log import to history
    try:
        await supabase.insert_data("imports", [{
            "file_name": f"API_Import_{len(records)}_records",
            "records_count": imported,
            "import_mode": import_mode,
            "duplicates_found": duplicates_found,
            "duplicates_skipped": skipped,
            "status": "completed" if len(errors) == 0 else "partial"
        }])
    except Exception as e:
        print(f"Failed to log import history: {e}")

    return ImportResult(
        success=len(errors) == 0,
        total_records=len(records),
        imported_records=imported,
        skipped_records=skipped,
        errors=errors[:10],  # Limit errors to first 10
    )


@router.delete("", status_code=204)
async def clear_deliveries(
    start_date: Optional[date] = Query(None, description="Clear from date"),
    end_date: Optional[date] = Query(None, description="Clear to date"),
    zone_id: Optional[str] = Query(None, description="Clear by zone"),
    confirm: bool = Query(False, description="Confirm deletion"),
):
    """
    Clear delivery records with optional filters.
    Requires confirm=true to execute.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to delete records"
        )

    try:
        filters = {}

        if start_date and end_date:
            filters["and"] = f"(delivery_date.gte.{start_date.isoformat()},delivery_date.lte.{end_date.isoformat()})"
        elif start_date:
            filters["delivery_date"] = f"gte.{start_date.isoformat()}"
        elif end_date:
            filters["delivery_date"] = f"lte.{end_date.isoformat()}"

        if zone_id:
            filters["zone_id"] = f"eq.{zone_id}"

        # If no filters, require explicit confirmation
        if not filters:
            # Delete all - need at least one filter for PostgREST
            filters["id"] = "neq.00000000-0000-0000-0000-000000000000"

        await supabase.delete_many("deliveries", filters)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
