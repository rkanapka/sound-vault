from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.post("/scan")
async def trigger_scan(client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/startScan.view",
        params=nd_params(),
        timeout=10,
    )
    r.raise_for_status()
    return {"ok": True}


@router.get("/scan-status")
async def get_scan_status(client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getScanStatus.view",
        params=nd_params(),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.post("/scrobble")
async def scrobble(client: HttpClient, id: str):
    r = await client.get(
        f"{settings.navidrome_url}/rest/scrobble.view",
        params=nd_params(id=id, submission=True),
        timeout=10,
    )
    r.raise_for_status()
    return {"ok": True}
