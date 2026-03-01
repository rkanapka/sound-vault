from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter(prefix="/api/library")

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


@router.get("/album/{album_id}")
async def get_album(album_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getAlbum.view",
        params=nd_params(id=album_id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.get("/search")
async def search_library(q: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/search3.view",
        params=nd_params(query=q, artistCount=5, albumCount=5, songCount=20),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


async def _proxy_nd(url: str, params: dict, request: Request) -> StreamingResponse:
    """Proxy a Navidrome request, forwarding Range headers for seek support."""
    forward_headers = {}
    if "range" in request.headers:
        forward_headers["Range"] = request.headers["range"]

    client = httpx.AsyncClient(timeout=httpx.Timeout(None))
    req = client.build_request("GET", url, params=params, headers=forward_headers)
    try:
        r = await client.send(req, stream=True)
    except Exception:
        await client.aclose()
        raise

    headers = {
        h: r.headers[h]
        for h in ["content-type", "content-length", "content-range", "accept-ranges"]
        if h in r.headers
    }
    return StreamingResponse(
        r.aiter_bytes(8192),
        status_code=r.status_code,
        headers=headers,
        background=BackgroundTask(client.aclose),
    )


@router.get("/stream/{song_id}")
async def stream_song(song_id: str, request: Request):
    return await _proxy_nd(
        f"{settings.navidrome_url}/rest/stream.view",
        nd_params(id=song_id),
        request,
    )


@router.get("/art/{item_id}")
async def get_cover_art(item_id: str, request: Request, size: int = 200):
    return await _proxy_nd(
        f"{settings.navidrome_url}/rest/getCoverArt.view",
        nd_params(id=item_id, size=size),
        request,
    )


@router.get("/song/{song_id}")
async def get_song(song_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getSong.view",
        params=nd_params(id=song_id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.post("/scan")
async def trigger_scan(client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/startScan.view",
        params=nd_params(),
        timeout=10,
    )
    r.raise_for_status()
    return {"ok": True}
