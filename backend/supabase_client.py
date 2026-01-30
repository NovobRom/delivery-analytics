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

        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self.base_url = f"{self.url}/rest/v1"

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
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{table}",
                headers=self.headers,
                params=query_params,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def get_by_id(self, table: str, id: str) -> Optional[dict]:
        """Fetch a single record by ID."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{table}",
                headers=self.headers,
                params={"id": f"eq.{id}", "select": "*"},
                timeout=30.0
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
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{table}",
                headers=self.headers,
                json=data,
                timeout=30.0
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
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}/{table}",
                headers=self.headers,
                params={"id": f"eq.{id}"},
                json=data,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            return result[0] if result else None

    async def delete_data(self, table: str, id: str) -> bool:
        """
        Delete a record by ID.

        Returns True if deletion was successful.
        """
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/{table}",
                headers=self.headers,
                params={"id": f"eq.{id}"},
                timeout=30.0
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
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/{table}",
                headers=self.headers,
                params=filters,
                timeout=30.0
            )
            response.raise_for_status()
            return True

    async def upsert_data(self, table: str, data: dict | list[dict]) -> list[dict]:
        """
        Insert or update records (upsert).
        Uses ON CONFLICT to update existing records.
        """
        headers = {**self.headers, "Prefer": "return=representation,resolution=merge-duplicates"}
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{table}",
                headers=headers,
                json=data,
                timeout=30.0
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
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.url}/rest/v1/rpc/{function_name}",
                headers=self.headers,
                json=params or {},
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def get_count(self, table: str, filters: Optional[dict] = None) -> int:
        """Get count of records in a table with optional filters."""
        headers = {**self.headers, "Prefer": "count=exact"}
        params = filters or {}
        params["select"] = "*"

        async with httpx.AsyncClient() as client:
            response = await client.head(
                f"{self.base_url}/{table}",
                headers=headers,
                params=params,
                timeout=30.0
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
