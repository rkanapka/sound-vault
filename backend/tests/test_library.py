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
    import routers.library.files as lib
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
    import routers.library.files as lib
    from config import Settings

    monkeypatch.setattr(lib, "settings", Settings(music_dir=str(tmp_path)))

    with respx.mock:
        _mock_delete_prereqs("/etc/passwd")
        r = await client.delete("/api/library/song/s1")

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_delete_song_file_not_on_disk(client, monkeypatch, tmp_path):
    import routers.library.files as lib
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


# ---------------------------------------------------------------------------
# album-list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_album_list_newest(client):
    albums = [{"id": "1", "name": "Kid A"}, {"id": "2", "name": "OK Computer"}]
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/getAlbumList2.view").mock(
            return_value=httpx.Response(200, json=nd_ok(albumList2={"album": albums}))
        )
        r = await client.get("/api/library/album-list?type=newest&size=10")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["albumList2"]["album"] == albums
    assert "type=newest" in str(route.calls[0].request.url)
    assert "size=10" in str(route.calls[0].request.url)


@pytest.mark.asyncio
async def test_get_album_list_recent(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/getAlbumList2.view").mock(
            return_value=httpx.Response(200, json=nd_ok(albumList2={"album": []}))
        )
        r = await client.get("/api/library/album-list?type=recent")
    assert r.status_code == 200
    assert "type=recent" in str(route.calls[0].request.url)


@pytest.mark.asyncio
async def test_get_album_list_default_params(client):
    """Defaults to type=newest, size=20 when not specified."""
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/getAlbumList2.view").mock(
            return_value=httpx.Response(200, json=nd_ok(albumList2={}))
        )
        r = await client.get("/api/library/album-list")
    assert r.status_code == 200
    assert "type=newest" in str(route.calls[0].request.url)
    assert "size=20" in str(route.calls[0].request.url)


@pytest.mark.asyncio
async def test_get_album_list_navidrome_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getAlbumList2.view").mock(return_value=httpx.Response(500))
        r = await client.get("/api/library/album-list")
    assert r.status_code == 502


# ---------------------------------------------------------------------------
# scrobble
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scrobble(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/scrobble.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.post("/api/library/scrobble?id=song123")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    assert "id=song123" in str(route.calls[0].request.url)
    assert "submission=true" in str(route.calls[0].request.url)


@pytest.mark.asyncio
async def test_scrobble_navidrome_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/scrobble.view").mock(return_value=httpx.Response(500))
        r = await client.post("/api/library/scrobble?id=song123")
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


# ---------------------------------------------------------------------------
# playlists
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_playlists(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getPlaylists.view").mock(
            return_value=httpx.Response(200, json=nd_ok(playlists={"playlist": []}))
        )
        r = await client.get("/api/library/playlists")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["status"] == "ok"


@pytest.mark.asyncio
async def test_get_playlist(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getPlaylist.view").mock(
            return_value=httpx.Response(200, json=nd_ok(playlist={"id": "pl1", "name": "Favs"}))
        )
        r = await client.get("/api/library/playlist/pl1")
    assert r.status_code == 200
    assert r.json()["subsonic-response"]["playlist"]["id"] == "pl1"


@pytest.mark.asyncio
async def test_create_playlist_with_initial_songs(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/createPlaylist.view").mock(
            return_value=httpx.Response(200, json=nd_ok(playlist={"id": "pl1", "name": "Roadtrip"}))
        )
        r = await client.post(
            "/api/library/playlists", json={"name": "Roadtrip", "song_ids": ["s1", "s2"]}
        )
    assert r.status_code == 201
    url = str(route.calls[0].request.url)
    assert "name=Roadtrip" in url
    assert "songId=s1" in url
    assert "songId=s2" in url


@pytest.mark.asyncio
async def test_update_playlist_rename_add_and_remove(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/updatePlaylist.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.put(
            "/api/library/playlist/pl1",
            json={
                "name": "Renamed",
                "song_ids_to_add": ["s9"],
                "song_indexes_to_remove": [0, 2],
            },
        )
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    url = str(route.calls[0].request.url)
    assert "playlistId=pl1" in url
    assert "name=Renamed" in url
    assert "songIdToAdd=s9" in url
    assert "songIndexToRemove=0" in url
    assert "songIndexToRemove=2" in url


@pytest.mark.asyncio
async def test_delete_playlist(client):
    with respx.mock:
        route = respx.get(f"{ND_BASE}/rest/deletePlaylist.view").mock(
            return_value=httpx.Response(200, json=nd_ok())
        )
        r = await client.delete("/api/library/playlist/pl1")
    assert r.status_code == 204
    assert "id=pl1" in str(route.calls[0].request.url)


@pytest.mark.asyncio
async def test_playlist_auth_error(client):
    with respx.mock:
        respx.get(f"{ND_BASE}/rest/getPlaylists.view").mock(
            return_value=httpx.Response(200, json=nd_fail(40, "Wrong username or password"))
        )
        r = await client.get("/api/library/playlists")
    assert r.status_code == 401
    assert "Navidrome error" in r.json()["detail"]
