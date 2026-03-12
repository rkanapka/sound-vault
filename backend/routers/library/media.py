import logging

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse
from starlette.background import BackgroundTask

from config import settings
from dependencies import nd_params

router = APIRouter()
logger = logging.getLogger(__name__)


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


def _proxy_headers(response: httpx.Response) -> dict:
    return {
        h: response.headers[h]
        for h in ["content-type", "content-length", "content-range", "accept-ranges"]
        if h in response.headers
    }


def _is_image_response(response: httpx.Response) -> bool:
    return response.headers.get("content-type", "").lower().startswith("image/")


@router.get("/stream/{song_id}")
async def stream_song(song_id: str, request: Request):
    return await _proxy_nd(
        f"{settings.navidrome_url}/rest/stream.view",
        nd_params(id=song_id),
        request,
    )


@router.get("/art/{item_id}")
async def get_cover_art(item_id: str, request: Request, size: int = 200):
    forward_headers = {}
    if "range" in request.headers:
        forward_headers["Range"] = request.headers["range"]

    client = request.app.state.http_client
    url = f"{settings.navidrome_url}/rest/getCoverArt.view"
    resp = await client.get(url, params=nd_params(id=item_id, size=size), headers=forward_headers)

    # Navidrome can return a JSON/XML error for smaller resized artist-art requests
    # while still serving the original image at 400px for the same item.
    if not _is_image_response(resp) and size < 400:
        logger.warning(
            "Navidrome returned non-image cover art for %s at size=%s; retrying at size=400",
            item_id,
            size,
        )
        fallback = await client.get(
            url,
            params=nd_params(id=item_id, size=400),
            headers=forward_headers,
        )
        if _is_image_response(fallback):
            resp = fallback

    headers = _proxy_headers(resp)
    headers["cache-control"] = (
        "public, max-age=86400, immutable" if _is_image_response(resp) else "no-store"
    )
    return Response(content=resp.content, status_code=resp.status_code, headers=headers)
