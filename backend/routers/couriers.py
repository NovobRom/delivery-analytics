from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from httpx import HTTPStatusError

from backend.supabase_client import supabase
from backend.models import CourierCreate, CourierUpdate, CourierResponse

router = APIRouter(prefix="/api/couriers", tags=["Couriers"])


@router.get("", response_model=list[CourierResponse])
async def get_couriers(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Get all couriers with optional filters."""
    try:
        params = {
            "select": "*",
            "order": "full_name.asc",
            "limit": limit,
            "offset": offset,
        }

        if is_active is not None:
            params["is_active"] = f"eq.{str(is_active).lower()}"

        if search:
            params["full_name"] = f"ilike.%{search}%"

        return await supabase.get_data("couriers", params)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/{courier_id}", response_model=CourierResponse)
async def get_courier(courier_id: str):
    """Get a single courier by ID."""
    try:
        courier = await supabase.get_by_id("couriers", courier_id)
        if not courier:
            raise HTTPException(status_code=404, detail="Courier not found")
        return courier
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("", response_model=CourierResponse, status_code=201)
async def create_courier(courier: CourierCreate):
    """Create a new courier."""
    try:
        result = await supabase.insert_data("couriers", courier.model_dump())
        return result[0]
    except HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(status_code=409, detail="Courier already exists")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.patch("/{courier_id}", response_model=CourierResponse)
async def update_courier(courier_id: str, courier: CourierUpdate):
    """Update an existing courier."""
    try:
        update_data = courier.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Add updated_at timestamp
        update_data["updated_at"] = "now()"

        result = await supabase.update_data("couriers", courier_id, update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Courier not found")
        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.delete("/{courier_id}", status_code=204)
async def delete_courier(courier_id: str):
    """Delete a courier."""
    try:
        # Check if courier exists
        courier = await supabase.get_by_id("couriers", courier_id)
        if not courier:
            raise HTTPException(status_code=404, detail="Courier not found")

        await supabase.delete_data("couriers", courier_id)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("/{courier_id}/deactivate", response_model=CourierResponse)
async def deactivate_courier(courier_id: str):
    """Deactivate a courier (soft delete)."""
    try:
        result = await supabase.update_data(
            "couriers",
            courier_id,
            {"is_active": False, "updated_at": "now()"}
        )
        if not result:
            raise HTTPException(status_code=404, detail="Courier not found")
        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("/{courier_id}/activate", response_model=CourierResponse)
async def activate_courier(courier_id: str):
    """Activate a courier."""
    try:
        result = await supabase.update_data(
            "couriers",
            courier_id,
            {"is_active": True, "updated_at": "now()"}
        )
        if not result:
            raise HTTPException(status_code=404, detail="Courier not found")
        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
