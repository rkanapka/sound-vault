from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.get("/search")
async def search_library(q: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/search3.view",
        params=nd_params(query=q, artistCount=5, albumCount=5, songCount=20),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())
