from .couriers import router as couriers_router
from .zones import router as zones_router
from .deliveries import router as deliveries_router
from .analytics import router as analytics_router
from .courier_performance import router as courier_performance_router
from .pickup_orders import router as pickup_orders_router

__all__ = [
    "couriers_router",
    "zones_router",
    "deliveries_router",
    "analytics_router",
    "courier_performance_router",
    "pickup_orders_router",
]
