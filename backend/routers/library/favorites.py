from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.get("/starred")
async def get_starred(client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getStarred2.view",
        params=nd_params(),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.post("/star")
async def star_song(id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/star.view",
        params=nd_params(id=id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.post("/unstar")
async def unstar_song(id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/unstar.view",
        params=nd_params(id=id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())
