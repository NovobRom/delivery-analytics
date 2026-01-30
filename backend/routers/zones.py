from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from httpx import HTTPStatusError

from backend.supabase_client import supabase
from backend.models import ZoneCreate, ZoneResponse

router = APIRouter(prefix="/api/zones", tags=["Zones"])


@router.get("", response_model=list[ZoneResponse])
async def get_zones(
    search: Optional[str] = Query(None, description="Search by name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Get all zones with optional filters."""
    try:
        params = {
            "select": "*",
            "order": "name.asc",
            "limit": limit,
            "offset": offset,
        }

        if search:
            params["name"] = f"ilike.%{search}%"

        return await supabase.get_data("zones", params)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/{zone_id}", response_model=ZoneResponse)
async def get_zone(zone_id: str):
    """Get a single zone by ID."""
    try:
        zone = await supabase.get_by_id("zones", zone_id)
        if not zone:
            raise HTTPException(status_code=404, detail="Zone not found")
        return zone
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("", response_model=ZoneResponse, status_code=201)
async def create_zone(zone: ZoneCreate):
    """Create a new zone."""
    try:
        result = await supabase.insert_data("zones", zone.model_dump())
        return result[0]
    except HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(status_code=409, detail="Zone with this name already exists")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.patch("/{zone_id}", response_model=ZoneResponse)
async def update_zone(zone_id: str, zone: ZoneCreate):
    """Update an existing zone."""
    try:
        result = await supabase.update_data("zones", zone_id, zone.model_dump())
        if not result:
            raise HTTPException(status_code=404, detail="Zone not found")
        return result
    except HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(status_code=409, detail="Zone with this name already exists")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.delete("/{zone_id}", status_code=204)
async def delete_zone(zone_id: str):
    """Delete a zone."""
    try:
        zone = await supabase.get_by_id("zones", zone_id)
        if not zone:
            raise HTTPException(status_code=404, detail="Zone not found")

        await supabase.delete_data("zones", zone_id)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
