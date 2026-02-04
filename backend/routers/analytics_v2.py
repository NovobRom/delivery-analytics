from datetime import date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from backend.supabase_client import supabase

router = APIRouter(prefix="/api/analytics/v2", tags=["Analytics V2"])

@router.get("/delivery/summary")
async def get_daily_stats():
    """
    Get daily delivery statistics
    Source: v2_daily_stats view
    """
    try:
        # Fetch data from view
        data = await supabase.get_data("v2_daily_stats", {"order": "date.desc"})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/delivery/couriers")
async def get_courier_performance():
    """
    Get courier daily performance data
    Source: v2_courier_daily_stats view
    """
    try:
        # Using daily stats allows frontend to filter by date locally
        data = await supabase.get_data("v2_courier_daily_stats", {"order": "report_date.desc"})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/delivery/failures")
async def get_failure_reasons():
    """
    Get breakdown of failure reasons
    Source: v2_failure_reasons view
    """
    try:
        data = await supabase.get_data("v2_failure_reasons", {"order": "count.desc"})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pickup/summary")
async def get_pickup_stats():
    """
    Get pickup (shipment source A) statistics
    Source: v2_shipment_stats view
    """
    try:
        data = await supabase.get_data("v2_shipment_stats", {"order": "pickup_execution_date.desc"})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
