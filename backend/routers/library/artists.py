from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

from .native import get_native_item

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.get("/artists")
async def get_artists(client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getArtists.view",
        params=nd_params(),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.get("/artist/{artist_id}")
async def get_artist(artist_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getArtist.view",
        params=nd_params(id=artist_id),
        timeout=10,
    )
    r.raise_for_status()
    payload = nd_unwrap(r.json())
    artist = payload["subsonic-response"].get("artist")

    native_artist = await get_native_item(client, f"/api/artist/{artist_id}")
    if artist and native_artist:
        image_url = (
            native_artist.get("largeImageUrl")
            or native_artist.get("mediumImageUrl")
            or native_artist.get("smallImageUrl")
        )
        if native_artist.get("biography"):
            artist["biography"] = native_artist["biography"]
        if image_url:
            artist["artistImageUrl"] = image_url
        for field in ("smallImageUrl", "mediumImageUrl", "largeImageUrl", "externalInfoUpdatedAt"):
            if native_artist.get(field):
                artist[field] = native_artist[field]

    return payload
