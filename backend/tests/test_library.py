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


@pytest.mark.asyncio
async def test_get_song(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getSong.view").mock(
            return_value=httpx.Response(200, json=nd_ok(song={"id": "1", "title": "Creep"}))
        )
        r = await client.get("/api/library/song/1")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["status"] == "ok"


@pytest.mark.asyncio
async def test_get_song_auth_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getSong.view").mock(
            return_value=httpx.Response(200, json=nd_fail(40, "Wrong username or password"))
        )
        r = await client.get("/api/library/song/1")
    assert r.status_code == 401
    assert "Navidrome error" in r.json()["detail"]


@pytest.mark.asyncio
async def test_stream_song(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/stream.view").mock(
            return_value=httpx.Response(
                200, content=b"audio-data", headers={"content-type": "audio/mpeg"}
            )
        )
        r = await client.get("/api/library/stream/1")
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/mpeg"


@pytest.mark.asyncio
async def test_stream_song_forwards_range_header(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/stream.view").mock(
            return_value=httpx.Response(
                206,
                content=b"partial",
                headers={
                    "content-type": "audio/mpeg",
                    "content-range": "bytes 0-6/100",
                    "accept-ranges": "bytes",
                },
            )
        )
        r = await client.get("/api/library/stream/1", headers={"Range": "bytes=0-6"})
    assert r.status_code == 206
    assert r.headers["content-range"] == "bytes 0-6/100"
    assert route.calls[0].request.headers["range"] == "bytes=0-6"


@pytest.mark.asyncio
async def test_get_cover_art(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getCoverArt.view").mock(
            return_value=httpx.Response(
                200, content=b"image-data", headers={"content-type": "image/jpeg"}
            )
        )
        r = await client.get("/api/library/art/1")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"


@pytest.mark.asyncio
async def test_get_cover_art_size_param(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/getCoverArt.view").mock(
            return_value=httpx.Response(
                200, content=b"image-data", headers={"content-type": "image/jpeg"}
            )
        )
        r = await client.get("/api/library/art/1?size=400")
    assert r.status_code == 200
    assert "size=400" in str(route.calls[0].request.url)


# ---------------------------------------------------------------------------
# delete_song
# ---------------------------------------------------------------------------


def _mock_delete_prereqs(song_path: str, token: str = "tok"):
    """Register the two Navidrome calls that always precede file deletion."""
    respx.post(f"{ND_BASE}/auth/login").mock(
        return_value=httpx.Response(200, json={"token": token})
    )
    respx.get(f"{ND_BASE}/api/song/s1").mock(
        return_value=httpx.Response(200, json={"path": song_path})
    )


@pytest.mark.asyncio
async def test_delete_song(client, monkeypatch, tmp_path):
    import routers.library as lib
    from config import Settings

    song_file = tmp_path / "Artist" / "Album" / "song.mp3"
    song_file.parent.mkdir(parents=True)
    song_file.write_bytes(b"fake audio")

    monkeypatch.setattr(lib, "settings", Settings(music_dir=str(tmp_path)))

    with respx.mock:
        _mock_delete_prereqs(str(song_file))
        respx.get(f"{ND_BASE}/rest/startScan.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.delete("/api/library/song/s1")

    assert r.status_code == 204
    assert not song_file.exists()


@pytest.mark.asyncio
async def test_delete_song_path_outside_music_dir(client, monkeypatch, tmp_path):
    import routers.library as lib
    from config import Settings

    monkeypatch.setattr(lib, "settings", Settings(music_dir=str(tmp_path)))

    with respx.mock:
        _mock_delete_prereqs("/etc/passwd")
        r = await client.delete("/api/library/song/s1")

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_delete_song_file_not_on_disk(client, monkeypatch, tmp_path):
    import routers.library as lib
    from config import Settings

    monkeypatch.setattr(lib, "settings", Settings(music_dir=str(tmp_path)))

    with respx.mock:
        _mock_delete_prereqs(str(tmp_path / "missing.mp3"))
        r = await client.delete("/api/library/song/s1")

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_song_navidrome_auth_failure(client):
    with respx.mock:
        respx.post(f"{ND_BASE}/auth/login").mock(return_value=httpx.Response(401))
        r = await client.delete("/api/library/song/s1")

    assert r.status_code == 502


# ---------------------------------------------------------------------------
# scan-status
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_scan_status(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getScanStatus.view").mock(
            return_value=httpx.Response(
                200, json=nd_ok(scanStatus={"scanning": False, "count": 42})
            )
        )
        r = await client.get("/api/library/scan-status")

    assert r.status_code == 200
    scan = r.json()["subsonic-response"]["scanStatus"]
    assert scan["scanning"] is False
    assert scan["count"] == 42


@pytest.mark.asyncio
async def test_get_scan_status_while_scanning(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getScanStatus.view").mock(
            return_value=httpx.Response(200, json=nd_ok(scanStatus={"scanning": True, "count": 7}))
        )
        r = await client.get("/api/library/scan-status")

    assert r.status_code == 200
    assert r.json()["subsonic-response"]["scanStatus"]["scanning"] is True
