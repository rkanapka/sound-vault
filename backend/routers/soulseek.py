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
    r = await client.get(
        f"{settings.slskd_url}/api/v0/searches/{search_id}/responses",
        timeout=10,
    )
    if not r.is_success:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


@router.delete("/search/{search_id}")
async def delete_search(search_id: str, client: HttpClient):
    await client.delete(
        f"{settings.slskd_url}/api/v0/searches/{search_id}",
        timeout=10,
    )
    return {"ok": True}


@router.post("/download")
async def download_file(body: DownloadRequest, client: HttpClient):
    r = await client.post(
        f"{settings.slskd_url}/api/v0/transfers/downloads/{body.username}",
        json=[{"filename": body.filename, "size": body.size}],
        timeout=10,
    )
    if not r.is_success:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"ok": True}
