from typing import Any

import httpx

from config import settings


async def get_native_item(client: httpx.AsyncClient, path: str) -> dict[str, Any] | None:
    try:
        auth_r = await client.post(
            f"{settings.navidrome_url}/auth/login",
            json={"username": settings.navidrome_user, "password": settings.navidrome_pass},
            timeout=10,
        )
        auth_r.raise_for_status()
        token = auth_r.json()["token"]

        r = await client.get(
            f"{settings.navidrome_url}{path}",
            headers={"X-Nd-Authorization": f"Bearer {token}"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, dict) else None
    except httpx.HTTPError, KeyError, ValueError:
        return None
