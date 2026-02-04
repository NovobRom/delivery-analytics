from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from backend.routers import (
    couriers_router,
    zones_router,
    deliveries_router,
    analytics_router,
    courier_performance_router,
    pickup_orders_router,
)
from backend.supabase_client import supabase


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the application."""
    # Startup: Initialize resources
    await supabase.connect()
    yield
    # Shutdown: Clean up resources
    await supabase.close()


# Initialize FastAPI app
app = FastAPI(
    title="Delivery Analytics API",
    description="Backend API for delivery analytics dashboard with courier performance and pickup orders",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(couriers_router)
app.include_router(zones_router)
app.include_router(deliveries_router)
app.include_router(analytics_router)
app.include_router(courier_performance_router)
app.include_router(pickup_orders_router)


@app.get("/")
def health_check():
    """Health check endpoint."""
    return {
        "status": "online",
        "message": "Delivery Analytics API is running",
        "version": "2.0.0",
    }


@app.get("/api")
def api_info():
    """API information endpoint."""
    return {
        "name": "Delivery Analytics API",
        "version": "2.0.0",
        "endpoints": {
            "couriers": "/api/couriers",
            "zones": "/api/zones",
            "deliveries": "/api/deliveries",
            "analytics": "/api/analytics",
            "courier_performance": "/courier-performance",
            "pickup_orders": "/pickup-orders",
        },
    }
