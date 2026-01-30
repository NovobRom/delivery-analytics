from datetime import date
from typing import Optional
from pydantic import BaseModel


class PeriodStats(BaseModel):
    """Statistics for a given period."""
    total_loaded: int
    total_delivered: int
    success_rate: float
    active_couriers: int
    delivery_days: int
    undelivered: int = 0


class CourierStats(BaseModel):
    """Statistics for a single courier."""
    id: str
    full_name: str
    vehicle_number: Optional[str]
    total_deliveries: int
    total_loaded: int
    total_delivered: int
    success_rate: float
    first_delivery: Optional[date]
    last_delivery: Optional[date]


class ZoneStats(BaseModel):
    """Statistics for a single zone."""
    id: str
    name: str
    total_deliveries: int
    total_loaded: int
    total_delivered: int
    success_rate: float


class DailyStats(BaseModel):
    """Daily aggregated statistics."""
    delivery_date: date
    active_couriers: int
    total_loaded: int
    total_delivered: int
    success_rate: float


class TopCourier(BaseModel):
    """Top performing courier."""
    courier_id: str
    full_name: str
    vehicle_number: Optional[str]
    total_loaded: int
    total_delivered: int
    success_rate: float


class TrendPoint(BaseModel):
    """Single point in a trend chart."""
    date: date
    value: float
    label: Optional[str] = None


class AnalyticsSummary(BaseModel):
    """Complete analytics summary."""
    period_stats: PeriodStats
    daily_trend: list[DailyStats]
    top_couriers: list[TopCourier]
    zone_stats: list[ZoneStats]
    best_courier: Optional[TopCourier] = None
    worst_zone: Optional[ZoneStats] = None
    insights: list[str] = []
