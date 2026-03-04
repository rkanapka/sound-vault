import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from config import settings
from dependencies import nd_params

router = APIRouter()


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
