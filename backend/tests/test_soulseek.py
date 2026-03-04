import httpx
import pytest
import respx

from config import Settings
from routers import soulseek as soulseek_router

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
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(
            return_value=httpx.Response(200, json={"isComplete": False})
        )
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(200, json=[])
        )
        r = await client.get("/api/soulseek/search/abc123")
    assert r.status_code == 200
    assert r.json() == {"isComplete": False, "responses": []}


@pytest.mark.asyncio
async def test_get_search_results_marks_already_downloaded_file(client, monkeypatch, tmp_path):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "Artist/Album/song.mp3"
    file_path = tmp_path / "Artist" / "Album" / "song.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(
            return_value=httpx.Response(200, json={"isComplete": True})
        )
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(
                200, json=[{"username": "user1", "files": [{"filename": rel_name, "size": 1234}]}]
            )
        )
        r = await client.get("/api/soulseek/search/abc123")

    assert r.status_code == 200
    files = r.json()["responses"][0]["files"]
    assert files[0]["alreadyDownloaded"] is True


@pytest.mark.asyncio
async def test_get_search_results_marks_missing_file_false(client, monkeypatch, tmp_path):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))

    with respx.mock:
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(
            return_value=httpx.Response(200, json={"isComplete": True})
        )
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(
                200,
                json=[{"username": "user1", "files": [{"filename": "Artist/Album/missing.mp3"}]}],
            )
        )
        r = await client.get("/api/soulseek/search/abc123")

    assert r.status_code == 200
    files = r.json()["responses"][0]["files"]
    assert files[0]["alreadyDownloaded"] is False


@pytest.mark.asyncio
async def test_get_search_results_marks_user_prefixed_path_downloaded(
    client, monkeypatch, tmp_path
):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "Artist/Album/song.mp3"
    file_path = tmp_path / "user1" / "Artist" / "Album" / "song.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(
            return_value=httpx.Response(200, json={"isComplete": True})
        )
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(
                200, json=[{"username": "user1", "files": [{"filename": rel_name, "size": 1234}]}]
            )
        )
        r = await client.get("/api/soulseek/search/abc123")

    assert r.status_code == 200
    files = r.json()["responses"][0]["files"]
    assert files[0]["alreadyDownloaded"] is True


@pytest.mark.asyncio
async def test_get_search_results_marks_truncated_tail_path_downloaded(
    client, monkeypatch, tmp_path
):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "Music/0_Tagged/Artist/2026 - Choke Me [Single]/01 - Choke Me.mp3"
    file_path = tmp_path / "2026 - Choke Me [Single]" / "01 - Choke Me.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(
            return_value=httpx.Response(200, json={"isComplete": True})
        )
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(
                200, json=[{"username": "user1", "files": [{"filename": rel_name, "size": 1234}]}]
            )
        )
        r = await client.get("/api/soulseek/search/abc123")

    assert r.status_code == 200
    files = r.json()["responses"][0]["files"]
    assert files[0]["alreadyDownloaded"] is True


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
async def test_download_file_returns_409_if_already_downloaded(client, monkeypatch, tmp_path):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "Artist/Album/song.mp3"
    file_path = tmp_path / "Artist" / "Album" / "song.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        route = respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(200)
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": rel_name, "size": 1234},
        )

    assert r.status_code == 409
    assert "already downloaded" in r.text.lower()
    assert route.called is False


@pytest.mark.asyncio
async def test_download_file_allows_non_existing_file(client, monkeypatch, tmp_path):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))

    with respx.mock:
        respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(200)
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": "Artist/Album/song.mp3", "size": 1234},
        )

    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.asyncio
async def test_download_file_returns_409_if_user_prefixed_path_exists(
    client, monkeypatch, tmp_path
):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "Artist/Album/song.mp3"
    file_path = tmp_path / "user1" / "Artist" / "Album" / "song.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        route = respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(200)
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": rel_name, "size": 1234},
        )

    assert r.status_code == 409
    assert route.called is False


@pytest.mark.asyncio
async def test_download_file_returns_409_if_truncated_tail_path_exists(
    client, monkeypatch, tmp_path
):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "Music/0_Tagged/Artist/2026 - Choke Me [Single]/01 - Choke Me.mp3"
    file_path = tmp_path / "2026 - Choke Me [Single]" / "01 - Choke Me.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        route = respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(200)
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": rel_name, "size": 1234},
        )

    assert r.status_code == 409
    assert route.called is False


@pytest.mark.asyncio
async def test_download_file_returns_409_if_slskd_duplicate_suffix_exists(
    client, monkeypatch, tmp_path
):
    monkeypatch.setattr(soulseek_router, "settings", Settings(music_dir=str(tmp_path)))
    rel_name = "2026 - Choke Me [Single]/01 - Choke Me.mp3"
    file_path = tmp_path / "2026 - Choke Me [Single]" / "01 - Choke Me_639082520649254851.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"audio")

    with respx.mock:
        route = respx.post(f"{SLSKD_BASE}/api/v0/transfers/downloads/user1").mock(
            return_value=httpx.Response(200)
        )
        r = await client.post(
            "/api/soulseek/download",
            json={"username": "user1", "filename": rel_name, "size": 1234},
        )

    assert r.status_code == 409
    assert route.called is False


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
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123").mock(
            return_value=httpx.Response(503, text="Service Unavailable")
        )
        respx.get(f"{SLSKD_BASE}/api/v0/searches/abc123/responses").mock(
            return_value=httpx.Response(200, json=[])
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
