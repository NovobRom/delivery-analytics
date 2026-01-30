from .couriers import router as couriers_router
from .zones import router as zones_router
from .deliveries import router as deliveries_router
from .analytics import router as analytics_router

__all__ = [
    "couriers_router",
    "zones_router",
    "deliveries_router",
    "analytics_router",
]
