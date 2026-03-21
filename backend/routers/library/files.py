import logging
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from config import settings
from dependencies import get_http_client, nd_params

router = APIRouter()
log = logging.getLogger(__name__)

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


def _prune_empty_parent_dirs(file_path: Path, music_dir: Path) -> None:
    parent = file_path.parent
    while parent != music_dir:
        try:
            parent.rmdir()
        except OSError:
            # Directory is non-empty or can't be removed; stop pruning.
            break
        parent = parent.parent


@router.delete("/song/{song_id}", status_code=204)
async def delete_song(song_id: str, client: HttpClient):
    # The Subsonic API returns a virtual metadata path (Artist/Album/file), not
    # the real filesystem path. Use Navidrome's own REST API instead.
    auth_r = await client.post(
        f"{settings.navidrome_url}/auth/login",
        json={"username": settings.navidrome_user, "password": settings.navidrome_pass},
        timeout=10,
    )
    auth_r.raise_for_status()
    token = auth_r.json().get("token")
    if not token:
        raise HTTPException(status_code=502, detail="Failed to authenticate with Navidrome")

    song_r = await client.get(
        f"{settings.navidrome_url}/api/song/{song_id}",
        headers={"X-Nd-Authorization": f"Bearer {token}"},
        timeout=10,
    )
    song_r.raise_for_status()
    song_path = song_r.json()["path"]

    music_dir = Path(settings.music_dir).resolve()
    p = Path(song_path)
    resolved = p.resolve() if p.is_absolute() else (music_dir / p).resolve()

    log.info(
        "delete_song: real_path=%r resolved=%s exists=%s", song_path, resolved, resolved.exists()
    )

    if not str(resolved).startswith(str(music_dir) + "/"):
        raise HTTPException(status_code=400, detail=f"Invalid path: {resolved}")

    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {resolved}")

    resolved.unlink()
    _prune_empty_parent_dirs(resolved, music_dir)

    await client.get(
        f"{settings.navidrome_url}/rest/startScan.view",
        params=nd_params(),
        timeout=10,
    )
