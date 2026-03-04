from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter()

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


class CreatePlaylistBody(BaseModel):
    name: str
    song_ids: list[str] = Field(default_factory=list)


class UpdatePlaylistBody(BaseModel):
    name: str | None = None
    song_ids_to_add: list[str] = Field(default_factory=list)
    song_indexes_to_remove: list[int] = Field(default_factory=list)


@router.get("/playlists")
async def get_playlists(client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getPlaylists.view",
        params=nd_params(),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.get("/playlist/{playlist_id}")
async def get_playlist(playlist_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/getPlaylist.view",
        params=nd_params(id=playlist_id),
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.post("/playlists", status_code=201)
async def create_playlist(body: CreatePlaylistBody, client: HttpClient):
    params = list(nd_params(name=body.name).items())
    for sid in body.song_ids:
        params.append(("songId", sid))
    r = await client.get(
        f"{settings.navidrome_url}/rest/createPlaylist.view",
        params=params,
        timeout=10,
    )
    r.raise_for_status()
    return nd_unwrap(r.json())


@router.put("/playlist/{playlist_id}")
async def update_playlist(playlist_id: str, body: UpdatePlaylistBody, client: HttpClient):
    params = list(nd_params(playlistId=playlist_id).items())
    if body.name is not None:
        params.append(("name", body.name))
    for sid in body.song_ids_to_add:
        params.append(("songIdToAdd", sid))
    for idx in body.song_indexes_to_remove:
        params.append(("songIndexToRemove", idx))
    r = await client.get(
        f"{settings.navidrome_url}/rest/updatePlaylist.view",
        params=params,
        timeout=10,
    )
    r.raise_for_status()
    nd_unwrap(r.json())
    return {"ok": True}


@router.delete("/playlist/{playlist_id}", status_code=204)
async def delete_playlist(playlist_id: str, client: HttpClient):
    r = await client.get(
        f"{settings.navidrome_url}/rest/deletePlaylist.view",
        params=nd_params(id=playlist_id),
        timeout=10,
    )
    r.raise_for_status()
    nd_unwrap(r.json())
