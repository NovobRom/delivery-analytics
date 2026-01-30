import os
import httpx
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class SupabaseClient:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        
        if not self.url or not self.key:
            raise ValueError("❌ Error: SUPABASE_URL or SUPABASE_KEY not found in .env file")

        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        # Standard PostgREST endpoint
        self.base_url = f"{self.url}/rest/v1"

    async def get_data(self, table: str, query_params: dict = None):
        """
        Fetch data from a Supabase table using async HTTP request.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/{table}",
                    headers=self.headers,
                    params=query_params
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"⚠️ Supabase Error: {e.response.text}")
                raise e

    async def insert_data(self, table: str, data: dict):
        """
        Insert data into a Supabase table.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/{table}",
                    headers=self.headers,
                    json=data
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"⚠️ Insert Error: {e.response.text}")
                raise e

# Create a singleton instance to be imported elsewhere
supabase = SupabaseClient()