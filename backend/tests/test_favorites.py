import httpx
import pytest
import respx

ND_BASE = "http://navidrome:4533"

SONG = {"id": "s1", "title": "Creep", "artist": "Radiohead", "duration": 238}


def nd_ok(**body) -> dict:
    return {"subsonic-response": {"status": "ok", "version": "1.16.1", **body}}


def nd_fail(code: int, message: str) -> dict:
    return {
        "subsonic-response": {
            "status": "failed",
            "error": {"code": code, "message": message},
        }
    }


# ── GET /api/library/starred ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_starred_empty(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getStarred2.view").mock(
            return_value=httpx.Response(200, json=nd_ok(starred2={}))
        )
        r = await client.get("/api/library/starred")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["status"] == "ok"


@pytest.mark.asyncio
async def test_get_starred_with_songs(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getStarred2.view").mock(
            return_value=httpx.Response(
                200, json=nd_ok(starred2={"song": [SONG]})
            )
        )
        r = await client.get("/api/library/starred")
    assert r.status_code == 200
    songs = r.json()["subsonic-response"]["starred2"]["song"]
    assert len(songs) == 1
    assert songs[0]["id"] == "s1"


@pytest.mark.asyncio
async def test_get_starred_auth_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getStarred2.view").mock(
            return_value=httpx.Response(200, json=nd_fail(40, "Wrong username or password"))
        )
        r = await client.get("/api/library/starred")
    assert r.status_code == 401
    assert "Navidrome error" in r.json()["detail"]


@pytest.mark.asyncio
async def test_get_starred_navidrome_http_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getStarred2.view").mock(
            return_value=httpx.Response(503)
        )
        r = await client.get("/api/library/starred")
    assert r.status_code == 502


# ── POST /api/library/star ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_star_song(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/star.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.post("/api/library/star?id=s1")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["status"] == "ok"


@pytest.mark.asyncio
async def test_star_song_passes_id(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/star.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        await client.post("/api/library/star?id=s1")
    assert route.called
    assert route.calls[0].request.url.params["id"] == "s1"


@pytest.mark.asyncio
async def test_star_song_auth_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/star.view").mock(
            return_value=httpx.Response(200, json=nd_fail(40, "Wrong username or password"))
        )
        r = await client.post("/api/library/star?id=s1")
    assert r.status_code == 401
    assert "Navidrome error" in r.json()["detail"]


@pytest.mark.asyncio
async def test_star_song_missing_id(client):
    r = await client.post("/api/library/star")
    assert r.status_code == 422


# ── POST /api/library/unstar ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unstar_song(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/unstar.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.post("/api/library/unstar?id=s1")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["status"] == "ok"


@pytest.mark.asyncio
async def test_unstar_song_passes_id(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/unstar.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        await client.post("/api/library/unstar?id=s1")
    assert route.called
    assert route.calls[0].request.url.params["id"] == "s1"


@pytest.mark.asyncio
async def test_unstar_song_auth_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/unstar.view").mock(
            return_value=httpx.Response(200, json=nd_fail(40, "Wrong username or password"))
        )
        r = await client.post("/api/library/unstar?id=s1")
    assert r.status_code == 401
    assert "Navidrome error" in r.json()["detail"]


@pytest.mark.asyncio
async def test_unstar_song_missing_id(client):
    r = await client.post("/api/library/unstar")
    assert r.status_code == 422
