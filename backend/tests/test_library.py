import httpx
import pytest
import respx

ND_BASE = "http://navidrome:4533"


def nd_ok(**body) -> dict:
    return {"subsonic-response": {"status": "ok", "version": "1.16.1", **body}}


def nd_fail(code: int, message: str) -> dict:
    return {
        "subsonic-response": {
            "status": "failed",
            "error": {"code": code, "message": message},
        }
    }


@pytest.mark.asyncio
async def test_get_artists(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getArtists.view").mock(
            return_value=httpx.Response(200, json=nd_ok(artists={"index": []}))
        )
        r = await client.get("/api/library/artists")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["status"] == "ok"


@pytest.mark.asyncio
async def test_get_artist(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getArtist.view").mock(
            return_value=httpx.Response(200, json=nd_ok(artist={"id": "1", "name": "Radiohead"}))
        )
        r = await client.get("/api/library/artist/1")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_get_album(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getAlbum.view").mock(
            return_value=httpx.Response(200, json=nd_ok(album={"id": "1", "name": "OK Computer"}))
        )
        r = await client.get("/api/library/album/1")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_search_library(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get("/api/library/search?q=radiohead")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_navidrome_auth_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getArtists.view").mock(
            return_value=httpx.Response(200, json=nd_fail(40, "Wrong username or password"))
        )
        r = await client.get("/api/library/artists")
    assert r.status_code == 401
    assert "Navidrome error" in r.json()["detail"]


@pytest.mark.asyncio
async def test_trigger_scan(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/startScan.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.post("/api/library/scan")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
