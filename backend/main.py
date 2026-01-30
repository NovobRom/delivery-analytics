from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.supabase_client import supabase

# Initialize FastAPI app
app = FastAPI(title="Delivery Analytics API")

# Configure CORS (Allows browser to talk to backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """
    Root endpoint to check if server is running.
    """
    return {
        "status": "online", 
        "message": "✅ Delivery Analytics Backend is Running!"
    }

@app.get("/api/zones")
async def get_zones():
    """
    Test endpoint: Fetch zones from Supabase to verify DB connection.
    """
    try:
        # Fetch all zones, select all columns
        zones = await supabase.get_data("zones", {"select": "*"})
        return zones
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))