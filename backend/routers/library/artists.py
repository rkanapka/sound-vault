from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

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
    return nd_unwrap(r.json())
