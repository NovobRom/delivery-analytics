from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from httpx import HTTPStatusError

from backend.supabase_client import supabase
from backend.models import (
    PeriodStats,
    CourierStats,
    ZoneStats,
    DailyStats,
    TopCourier,
    AnalyticsSummary,
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_default_date_range() -> tuple[date, date]:
    """Return default date range (current month)."""
    today = date.today()
    start = today.replace(day=1)
    return start, today


@router.get("/summary", response_model=PeriodStats)
async def get_period_summary(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
):
    """
    Get aggregated statistics for a period.
    Uses stored function for efficiency.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    try:
        result = await supabase.rpc("get_period_stats", {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        })

        if result and len(result) > 0:
            data = result[0]
            total_loaded = data.get("total_loaded", 0) or 0
            total_delivered = data.get("total_delivered", 0) or 0
            return PeriodStats(
                total_loaded=total_loaded,
                total_delivered=total_delivered,
                success_rate=data.get("success_rate", 0) or 0,
                active_couriers=data.get("active_couriers", 0) or 0,
                delivery_days=data.get("delivery_days", 0) or 0,
                undelivered=total_loaded - total_delivered,
            )

        return PeriodStats(
            total_loaded=0,
            total_delivered=0,
            success_rate=0,
            active_couriers=0,
            delivery_days=0,
            undelivered=0,
        )
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/top-couriers", response_model=list[TopCourier])
async def get_top_couriers(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    limit: int = Query(10, ge=1, le=50, description="Number of top couriers"),
):
    """Get top performing couriers for a period."""
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    try:
        result = await supabase.rpc("get_top_couriers", {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "limit_count": limit,
        })

        return [
            TopCourier(
                courier_id=r["courier_id"],
                full_name=r["full_name"],
                vehicle_number=r.get("vehicle_number"),
                total_loaded=r["total_loaded"],
                total_delivered=r["total_delivered"],
                success_rate=r["success_rate"],
            )
            for r in result
        ]
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/daily", response_model=list[DailyStats])
async def get_daily_stats(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
):
    """Get daily statistics for charts."""
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    try:
        params = {
            "select": "*",
            "delivery_date": f"gte.{start_date.isoformat()}",
            "order": "delivery_date.asc",
        }

        # Add end_date filter
        data = await supabase.get_data("daily_stats", params)

        # Filter by end_date in Python (PostgREST limitation with views)
        filtered = [
            DailyStats(
                delivery_date=d["delivery_date"],
                active_couriers=d["active_couriers"],
                total_loaded=d["total_loaded"],
                total_delivered=d["total_delivered"],
                success_rate=d["success_rate"],
            )
            for d in data
            if d["delivery_date"] <= end_date.isoformat()
        ]

        return filtered
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/couriers", response_model=list[CourierStats])
async def get_courier_stats(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    min_deliveries: int = Query(0, ge=0, description="Minimum deliveries filter"),
):
    """Get statistics per courier."""
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    try:
        # Get deliveries for the period
        params = {
            "select": "courier_id, loaded_count, delivered_count, delivery_date",
            "and": f"(delivery_date.gte.{start_date.isoformat()},delivery_date.lte.{end_date.isoformat()})",
        }
        deliveries = await supabase.get_data("deliveries", params)

        # Get all couriers
        couriers = await supabase.get_data("couriers", {"select": "*"})
        courier_map = {c["id"]: c for c in couriers}

        # Aggregate by courier
        stats = {}
        for d in deliveries:
            cid = d["courier_id"]
            if cid not in stats:
                stats[cid] = {
                    "total_deliveries": 0,
                    "total_loaded": 0,
                    "total_delivered": 0,
                    "first_delivery": d["delivery_date"],
                    "last_delivery": d["delivery_date"],
                }
            stats[cid]["total_deliveries"] += 1
            stats[cid]["total_loaded"] += d["loaded_count"]
            stats[cid]["total_delivered"] += d["delivered_count"]
            if d["delivery_date"] < stats[cid]["first_delivery"]:
                stats[cid]["first_delivery"] = d["delivery_date"]
            if d["delivery_date"] > stats[cid]["last_delivery"]:
                stats[cid]["last_delivery"] = d["delivery_date"]

        # Build response
        result = []
        for cid, s in stats.items():
            if s["total_deliveries"] < min_deliveries:
                continue
            if cid not in courier_map:
                continue

            courier = courier_map[cid]
            loaded = s["total_loaded"]
            success_rate = (s["total_delivered"] / loaded * 100) if loaded > 0 else 0

            result.append(CourierStats(
                id=cid,
                full_name=courier["full_name"],
                vehicle_number=courier.get("vehicle_number"),
                total_deliveries=s["total_deliveries"],
                total_loaded=loaded,
                total_delivered=s["total_delivered"],
                success_rate=round(success_rate, 2),
                first_delivery=s["first_delivery"],
                last_delivery=s["last_delivery"],
            ))

        # Sort by success rate descending
        result.sort(key=lambda x: x.success_rate, reverse=True)
        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/zones", response_model=list[ZoneStats])
async def get_zone_stats(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
):
    """Get statistics per zone."""
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    try:
        # Get deliveries for the period
        params = {
            "select": "zone_id, loaded_count, delivered_count",
            "and": f"(delivery_date.gte.{start_date.isoformat()},delivery_date.lte.{end_date.isoformat()})",
        }
        deliveries = await supabase.get_data("deliveries", params)

        # Get all zones
        zones = await supabase.get_data("zones", {"select": "*"})
        zone_map = {z["id"]: z for z in zones}

        # Aggregate by zone
        stats = {}
        for d in deliveries:
            zid = d["zone_id"]
            if zid not in stats:
                stats[zid] = {
                    "total_deliveries": 0,
                    "total_loaded": 0,
                    "total_delivered": 0,
                }
            stats[zid]["total_deliveries"] += 1
            stats[zid]["total_loaded"] += d["loaded_count"]
            stats[zid]["total_delivered"] += d["delivered_count"]

        # Build response
        result = []
        for zid, s in stats.items():
            if zid not in zone_map:
                continue

            zone = zone_map[zid]
            loaded = s["total_loaded"]
            success_rate = (s["total_delivered"] / loaded * 100) if loaded > 0 else 0

            result.append(ZoneStats(
                id=zid,
                name=zone["name"],
                total_deliveries=s["total_deliveries"],
                total_loaded=loaded,
                total_delivered=s["total_delivered"],
                success_rate=round(success_rate, 2),
            ))

        # Sort by total loaded descending
        result.sort(key=lambda x: x.total_loaded, reverse=True)
        return result
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/full", response_model=AnalyticsSummary)
async def get_full_analytics(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
):
    """
    Get complete analytics summary in one request.
    Useful for dashboard initialization.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    try:
        # Fetch all data in parallel would be ideal, but for simplicity:
        period_stats = await get_period_summary(start_date, end_date)
        daily_trend = await get_daily_stats(start_date, end_date)
        top_couriers = await get_top_couriers(start_date, end_date, limit=10)
        zone_stats = await get_zone_stats(start_date, end_date)

        # Generate insights
        insights = []

        if top_couriers:
            best = top_couriers[0]
            insights.append(
                f"Top courier: {best.full_name} with {best.success_rate}% success rate"
            )

        if zone_stats:
            # Find worst zone
            worst_zone = min(zone_stats, key=lambda z: z.success_rate)
            if worst_zone.success_rate < 90:
                insights.append(
                    f"Attention: {worst_zone.name} has low success rate ({worst_zone.success_rate}%)"
                )

        if period_stats.success_rate < 95:
            insights.append(
                f"Overall success rate ({period_stats.success_rate}%) is below target (95%)"
            )

        if period_stats.undelivered > 0:
            insights.append(
                f"Undelivered packages: {period_stats.undelivered}"
            )

        return AnalyticsSummary(
            period_stats=period_stats,
            daily_trend=daily_trend,
            top_couriers=top_couriers,
            zone_stats=zone_stats,
            best_courier=top_couriers[0] if top_couriers else None,
            worst_zone=min(zone_stats, key=lambda z: z.success_rate) if zone_stats else None,
            insights=insights,
        )
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.get("/compare")
async def compare_periods(
    period1_start: date = Query(..., description="First period start"),
    period1_end: date = Query(..., description="First period end"),
    period2_start: date = Query(..., description="Second period start"),
    period2_end: date = Query(..., description="Second period end"),
):
    """Compare statistics between two periods."""
    try:
        stats1 = await get_period_summary(period1_start, period1_end)
        stats2 = await get_period_summary(period2_start, period2_end)

        def calc_change(old: float, new: float) -> float:
            if old == 0:
                return 100.0 if new > 0 else 0.0
            return round((new - old) / old * 100, 2)

        return {
            "period1": {
                "start": period1_start,
                "end": period1_end,
                "stats": stats1,
            },
            "period2": {
                "start": period2_start,
                "end": period2_end,
                "stats": stats2,
            },
            "changes": {
                "loaded_change": calc_change(stats1.total_loaded, stats2.total_loaded),
                "delivered_change": calc_change(stats1.total_delivered, stats2.total_delivered),
                "success_rate_change": round(stats2.success_rate - stats1.success_rate, 2),
                "couriers_change": calc_change(stats1.active_couriers, stats2.active_couriers),
            },
        }
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
