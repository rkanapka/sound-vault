import asyncio
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import settings
from dependencies import get_http_client

router = APIRouter(prefix="/api/soulseek")

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


class SearchRequest(BaseModel):
    query: str


class DownloadRequest(BaseModel):
    username: str
    filename: str
    size: int


def _resolve_music_path(filename: str) -> Path:
    cleaned = filename.replace("\\", "/")
    if not cleaned.strip():
        raise ValueError("Empty filename")

    parts = [part for part in cleaned.split("/") if part not in ("", ".")]
    if not parts:
        raise ValueError("Invalid filename")

    rel = Path(*parts)
    music_dir = Path(settings.music_dir).resolve()
    resolved = (music_dir / rel).resolve()

    if resolved == music_dir or not str(resolved).startswith(str(music_dir) + "/"):
        raise ValueError("Invalid path")

    return resolved


def _candidate_music_paths(filename: str, username: str | None = None) -> list[Path]:
    rel = filename.replace("\\", "/")
    rel_parts = [part for part in rel.split("/") if part not in ("", ".")]
    if not rel_parts:
        raise ValueError("Invalid filename")

    candidates = [_resolve_music_path(filename)]
    if username:
        candidates.append(_resolve_music_path(f"{username}/{filename}"))

    # slskd can save using only tail segments of the remote path (e.g. Album/File).
    max_tail = min(4, len(rel_parts))
    for depth in range(2, max_tail + 1):
        tail = "/".join(rel_parts[-depth:])
        candidates.append(_resolve_music_path(tail))
        if username:
            candidates.append(_resolve_music_path(f"{username}/{tail}"))

    return candidates


def _is_already_downloaded(filename: str, username: str | None = None) -> bool:
    try:
        for path in _candidate_music_paths(filename, username):
            if path.exists():
                return True
            # slskd appends a unique numeric suffix on duplicate writes:
            # "track.mp3" -> "track_<id>.mp3"
            suffix_matches = list(path.parent.glob(f"{path.stem}_*{path.suffix}"))
            if suffix_matches:
                return True
        return False
    except ValueError:
        return False


@router.post("/search")
async def create_search(body: SearchRequest, client: HttpClient):
    r = await client.post(
        f"{settings.slskd_url}/api/v0/searches",
        json={"searchText": body.query},
        timeout=10,
    )
    if not r.is_success:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


@router.get("/search/{search_id}")
async def get_search_results(search_id: str, client: HttpClient):
    state_r, responses_r = await asyncio.gather(
        client.get(f"{settings.slskd_url}/api/v0/searches/{search_id}", timeout=10),
        client.get(f"{settings.slskd_url}/api/v0/searches/{search_id}/responses", timeout=10),
    )
    if not state_r.is_success:
        raise HTTPException(status_code=state_r.status_code, detail=state_r.text)
    state = state_r.json()
    responses = responses_r.json() if responses_r.is_success else []
    for response in responses:
        username = response.get("username", "")
        for file in response.get("files", []):
            filename = file.get("filename", "")
            file["alreadyDownloaded"] = _is_already_downloaded(filename, username)
    return {"isComplete": state.get("isComplete", False), "responses": responses}


@router.delete("/search/{search_id}")
async def delete_search(search_id: str, client: HttpClient):
    await client.delete(
        f"{settings.slskd_url}/api/v0/searches/{search_id}",
        timeout=10,
    )
    return {"ok": True}


@router.post("/download")
async def download_file(body: DownloadRequest, client: HttpClient):
    try:
        _candidate_music_paths(body.filename, body.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if _is_already_downloaded(body.filename, body.username):
        raise HTTPException(status_code=409, detail="File already downloaded")

    r = await client.post(
        f"{settings.slskd_url}/api/v0/transfers/downloads/{body.username}",
        json=[{"filename": body.filename, "size": body.size}],
        timeout=10,
    )
    if not r.is_success:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"ok": True}
