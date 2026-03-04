from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.get("/album/{album_id}")
async def get_album(album_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getAlbum.view",
        params=nd_params(id=album_id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.get("/album-list")
async def get_album_list(client: HttpClient, type: str = "newest", size: int = 20):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getAlbumList2.view",
        params=nd_params(type=type, size=size),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())
