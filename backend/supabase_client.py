import os
from typing import Any, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()


class SupabaseClient:
    """Async Supabase client for PostgREST API operations."""

    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")

        if not self.url or not self.key:
            raise ValueError("SUPABASE_URL or SUPABASE_KEY not found in .env file")

        self.client: Optional[httpx.AsyncClient] = None

    async def connect(self):
        """Initialize the persistent HTTP client."""
        if self.client is None or self.client.is_closed:
            self.client = httpx.AsyncClient(
                base_url=f"{self.url}/rest/v1",
                headers={
                    "apikey": self.key,
                    "Authorization": f"Bearer {self.key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                timeout=30.0
            )

    async def close(self):
        """Close the persistent HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get the active client or create a new one if not connected."""
        if self.client is None or self.client.is_closed:
            await self.connect()
        return self.client

    async def get_data(
        self,
        table: str,
        query_params: Optional[dict] = None
    ) -> list[dict]:
        """
        Fetch data from a Supabase table.

        Args:
            table: Table name
            query_params: PostgREST query parameters (select, order, limit, etc.)
        """
        client = await self._get_client()
        response = await client.get(
            table,
            params=query_params
        )
        response.raise_for_status()
        return response.json()

    async def get_by_id(self, table: str, id: str) -> Optional[dict]:
        """Fetch a single record by ID."""
        client = await self._get_client()
        response = await client.get(
            table,
            params={"id": f"eq.{id}", "select": "*"}
        )
        response.raise_for_status()
        data = response.json()
        return data[0] if data else None

    async def insert_data(self, table: str, data: dict | list[dict]) -> list[dict]:
        """
        Insert one or multiple records into a table.

        Args:
            table: Table name
            data: Single dict or list of dicts to insert
        """
        client = await self._get_client()
        response = await client.post(
            table,
            json=data
        )
        response.raise_for_status()
        return response.json()

    async def update_data(
        self,
        table: str,
        id: str,
        data: dict
    ) -> Optional[dict]:
        """
        Update a record by ID.

        Args:
            table: Table name
            id: Record UUID
            data: Fields to update
        """
        client = await self._get_client()
        response = await client.patch(
            table,
            params={"id": f"eq.{id}"},
            json=data
        )
        response.raise_for_status()
        result = response.json()
        return result[0] if result else None

    async def delete_data(self, table: str, id: str) -> bool:
        """
        Delete a record by ID.

        Returns True if deletion was successful.
        """
        client = await self._get_client()
        response = await client.delete(
            table,
            params={"id": f"eq.{id}"}
        )
        response.raise_for_status()
        return True

    async def delete_many(self, table: str, filters: dict) -> bool:
        """
        Delete multiple records matching filters.

        Args:
            table: Table name
            filters: PostgREST filter params (e.g., {"zone_id": "eq.xxx"})
        """
        client = await self._get_client()
        response = await client.delete(
            table,
            params=filters
        )
        response.raise_for_status()
        return True

    async def upsert_data(self, table: str, data: dict | list[dict]) -> list[dict]:
        """
        Insert or update records (upsert).
        Uses ON CONFLICT to update existing records.
        """
        client = await self._get_client()
        # Merge default headers with specific Upsert preferences
        # PostgREST requires Prefer header for upsert behavior
        headers = {"Prefer": "return=representation,resolution=merge-duplicates"}
        
        response = await client.post(
            table,
            headers=headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

    async def rpc(
        self,
        function_name: str,
        params: Optional[dict] = None
    ) -> Any:
        """
        Call a PostgreSQL function (RPC).

        Args:
            function_name: Name of the stored function
            params: Function parameters
        """
        client = await self._get_client()
        response = await client.post(
            f"rpc/{function_name}",
            json=params or {}
        )
        response.raise_for_status()
        return response.json()

    async def get_count(self, table: str, filters: Optional[dict] = None) -> int:
        """Get count of records in a table with optional filters."""
        client = await self._get_client()
        # Override Prefer header for count
        headers = {"Prefer": "count=exact"}
        params = filters or {}
        params["select"] = "*"

        response = await client.head(
            table,
            headers=headers,
            params=params
        )
        response.raise_for_status()
        content_range = response.headers.get("content-range", "")
        # Format: "0-9/100" or "*/0"
        if "/" in content_range:
            total = content_range.split("/")[1]
            return int(total) if total != "*" else 0
        return 0


# Singleton instance
supabase = SupabaseClient()
