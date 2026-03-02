import httpx
import pytest
import respx

SLSKD_BASE = "http://slskd:5030"


@pytest.mark.asyncio
async def test_create_search(client):
    with respx.mock:
        respx.post(f"{SLSKD_BASE}/api/v0/searches").mock(
            return_value=httpx.Response(200, json={"id": "abc123"})
        )
        r = await client.post("/api/soulseek/search", json={"query": "pink floyd"})
    assert r.status_code == 200
    assert r.json()["id"] == "abc123"


@pytest.mark.asyncio
async def test_get_search_results(client):
    with respx.mock:
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(200, json=[])
        )
        r = await client.get("/api/soulseek/search/abc123")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_delete_search(client):
    with respx.mock:
        respx.delete(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(return_value=httpx.Response(200))
        r = await client.delete("/api/soulseek/search/abc123")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.asyncio
async def test_download_file(client):
    with respx.mock:
        respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(200)
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": "song.mp3", "size": 1234},
        )
    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.asyncio
async def test_create_search_upstream_error(client):
    with respx.mock:
        respx.post(f"{SLSKD_BASE}/api/v0/searches").mock(
            return_value=httpx.Response(503, text="Service Unavailable")
        )
        r = await client.post("/api/soulseek/search", json={"query": "test"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_get_search_results_upstream_error(client):
    with respx.mock:
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(503, text="Service Unavailable")
        )
        r = await client.get("/api/soulseek/search/abc123")
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_download_file_upstream_error(client):
    with respx.mock:
        respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(503, text="Service Unavailable")
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": "song.mp3", "size": 1234},
        )
    assert r.status_code == 503
