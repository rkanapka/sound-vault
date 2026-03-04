from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.get("/song/{song_id}")
async def get_song(song_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getSong.view",
        params=nd_params(id=song_id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())
