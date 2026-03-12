from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

from .native import get_native_item

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
    payload = nd_unwrap(r.json())
    album = payload["subsonic-response"].get("album")

    native_album = await get_native_item(client, f"/api/album/{album_id}")
    if album and native_album:
        if native_album.get("description"):
            album["description"] = native_album["description"]
        for field in ("smallImageUrl", "mediumImageUrl", "largeImageUrl", "externalInfoUpdatedAt"):
            if native_album.get(field):
                album[field] = native_album[field]

    return payload


@router.get("/album-list")
async def get_album_list(client: HttpClient, type: str = "newest", size: int = 20, offset: int = 0):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getAlbumList2.view",
        params=nd_params(type=type, size=size, offset=offset),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())
