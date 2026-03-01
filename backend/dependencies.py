import httpx
from fastapi import HTTPException, Request

from config import settings


def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


def nd_params(**extra) -> dict:
    return {
        "u": settings.navidrome_user,
        "p": settings.navidrome_pass,
        "c": "sound-vault",
        "v": "1.16.1",
        "f": "json",
        **extra,
    }


def nd_unwrap(data: dict) -> dict:
    """Raise 401 if Navidrome returns an auth/API error."""
    resp = data.get("subsonic-response", {})
    if resp.get("status") == "failed":
        err = resp.get("error", {})
        raise HTTPException(
            status_code=401,
            detail=f"Navidrome error {err.get('code')}: {err.get('message')}",
        )
    return data
