import httpx
import pytest
import respx

from routers import discover as discover_router

LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/"
ND_BASE = "http://navidrome:4533"


def nd_ok(**body) -> dict:
    return {"subsonic-response": {"status": "ok", "version": "1.16.1", **body}}


def lastfm_response(data: dict) -> httpx.Response:
    return httpx.Response(200, json=data)


@pytest.fixture(autouse=True)
def clear_discover_cache():
    discover_router._CACHE = {}
    yield
    discover_router._CACHE = {}


@pytest.mark.asyncio
async def test_discover_bootstrap_disabled_without_api_key(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", None)

    r = await client.get("/api/discover/bootstrap")

    assert r.status_code == 200
    assert r.json() == {"enabled": False, "topTags": []}


@pytest.mark.asyncio
async def test_discover_bootstrap_returns_top_tags(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["method"] == "tag.getTopTags"
        return lastfm_response(
            {
                "toptags": {
                    "tag": [
                        {"name": "electronic", "count": "1200"},
                        {"name": "ambient", "count": "800"},
                    ]
                }
            }
        )

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        r = await client.get("/api/discover/bootstrap")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": True,
        "topTags": [
            {"name": "electronic", "count": 1200, "reach": None},
            {"name": "ambient", "count": 800, "reach": None},
        ],
    }


@pytest.mark.asyncio
async def test_discover_tag_aggregates_and_resolves_library_matches(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "tag.getInfo":
            return lastfm_response(
                {
                    "tag": {
                        "name": "electronica",
                        "reach": "321",
                        "total": "654",
                        "wiki": {
                            "summary": (
                                "Warp-adjacent electronics. "
                                '<a href="https://last.fm">Read more on Last.fm</a>'
                            )
                        },
                    }
                }
            )
        if method == "tag.getSimilar":
            return lastfm_response(
                {
                    "similartags": {
                        "tag": [
                            {"name": "idm", "count": "420"},
                            {"name": "ambient", "count": "314"},
                        ]
                    }
                }
            )
        if method == "tag.getTopArtists":
            return lastfm_response(
                {
                    "topartists": {
                        "artist": [
                            {
                                "name": "Radiohead",
                                "image": [{"size": "large", "#text": "https://img/rh.jpg"}],
                            },
                            {"name": "Boards of Canada"},
                        ]
                    }
                }
            )
        if method == "artist.getInfo":
            artist = request.url.params["artist"]
            if artist == "Boards of Canada":
                return lastfm_response({"artist": {"name": artist}})
            if artist == "Radiohead":
                return lastfm_response({"artist": {"name": artist}})
            return lastfm_response({"artist": {"name": artist}})
        if method == "artist.getTopAlbums":
            artist = request.url.params["artist"]
            if artist == "Boards of Canada":
                return lastfm_response(
                    {
                        "topalbums": {
                            "album": [
                                {
                                    "name": "Music Has the Right to Children",
                                    "image": [{"size": "large", "#text": "http://img/boc.jpg"}],
                                }
                            ]
                        }
                    }
                )
            return lastfm_response({"topalbums": {"album": []}})
        if method == "tag.getTopAlbums":
            return lastfm_response(
                {
                    "albums": {
                        "album": [
                            {
                                "name": "In Rainbows",
                                "artist": {"name": "Radiohead"},
                                "image": [{"size": "large", "#text": "https://img/ir.jpg"}],
                            },
                            {"name": "Geogaddi", "artist": {"name": "Boards of Canada"}},
                        ]
                    }
                }
            )
        if method == "tag.getTopTracks":
            return lastfm_response(
                {
                    "tracks": {
                        "track": [
                            {
                                "name": "Weird Fishes/Arpeggi",
                                "artist": {"name": "Radiohead"},
                                "image": [{"size": "large", "#text": "https://img/wf.jpg"}],
                            },
                            {"name": "Dayvan Cowboy", "artist": {"name": "Boards of Canada"}},
                        ]
                    }
                }
            )
        if method == "track.getInfo":
            return lastfm_response(
                {
                    "track": {
                        "name": "Dayvan Cowboy",
                        "album": {
                            "title": "The Campfire Headphase",
                            "image": [{"size": "large", "#text": "http://img/dayvan.jpg"}],
                        },
                    }
                }
            )
        raise AssertionError(f"unexpected method: {method}")

    def navidrome_search_handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["query"]
        if query == "Radiohead":
            return httpx.Response(
                200,
                json=nd_ok(searchResult3={"artist": [{"id": "ar1", "name": "Radiohead"}]}),
            )
        if query == "Radiohead In Rainbows":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "album": [
                            {
                                "id": "al1",
                                "name": "In Rainbows",
                                "artist": "Radiohead",
                                "artistId": "ar1",
                            }
                        ]
                    }
                ),
            )
        if query == "Radiohead Weird Fishes/Arpeggi":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "song": [
                            {
                                "id": "so1",
                                "title": "Weird Fishes/Arpeggi",
                                "artist": "Radiohead",
                                "artistId": "ar1",
                                "albumId": "al1",
                            }
                        ]
                    }
                ),
            )
        return httpx.Response(200, json=nd_ok(searchResult3={}))

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(side_effect=navidrome_search_handler)
        r = await client.get("/api/discover/tag/electronica")

    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["tag"] == {
        "name": "electronica",
        "summary": "Warp-adjacent electronics.",
        "reach": 321,
        "total": 654,
    }
    assert body["similarTags"] == [
        {"name": "idm", "count": 420, "reach": None},
        {"name": "ambient", "count": 314, "reach": None},
    ]
    assert body["topArtists"][0]["title"] == "Radiohead"
    assert body["topArtists"][0]["inLibrary"] is True
    assert body["topArtists"][0]["artistId"] == "ar1"
    assert body["topArtists"][0]["imageUrl"] == "https://img/rh.jpg"
    assert body["topArtists"][1]["inLibrary"] is False
    assert body["topArtists"][1]["imageUrl"] == "https://img/boc.jpg"
    assert body["topArtists"][1]["soulseekQuery"] == "Boards of Canada"
    assert body["topAlbums"][0]["inLibrary"] is True
    assert body["topAlbums"][0]["albumId"] == "al1"
    assert body["topAlbums"][1]["soulseekQuery"] == "Boards of Canada Geogaddi"
    assert body["topTracks"][0]["inLibrary"] is True
    assert body["topTracks"][0]["songId"] == "so1"
    assert body["topTracks"][0]["albumId"] == "al1"
    assert body["topTracks"][0]["imageUrl"] == "https://img/wf.jpg"
    assert body["topTracks"][1]["inLibrary"] is False
    assert body["topTracks"][1]["imageUrl"] == "https://img/dayvan.jpg"
    assert body["topTracks"][1]["soulseekQuery"] == "Boards of Canada Dayvan Cowboy"


@pytest.mark.asyncio
async def test_discover_tag_survives_partial_lastfm_failure(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "tag.getSimilar":
            return httpx.Response(500, text="upstream failure")
        if method == "tag.getInfo":
            return lastfm_response({"tag": {"name": "ambient"}})
        if method == "tag.getTopArtists":
            return lastfm_response({"topartists": {"artist": [{"name": "Brian Eno"}]}})
        if method == "tag.getTopAlbums":
            return lastfm_response({"albums": {"album": []}})
        if method == "tag.getTopTracks":
            return lastfm_response({"tracks": {"track": []}})
        if method == "artist.getInfo":
            return httpx.Response(500, text="no image")
        raise AssertionError(f"unexpected method: {method}")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get("/api/discover/tag/ambient")

    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["tag"]["name"] == "ambient"
    assert body["similarTags"] == []
    assert body["topArtists"][0]["title"] == "Brian Eno"


@pytest.mark.asyncio
async def test_discover_tag_backfills_artist_and_track_images(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "tag.getInfo":
            return lastfm_response({"tag": {"name": "idm"}})
        if method == "tag.getSimilar":
            return lastfm_response({"similartags": {"tag": []}})
        if method == "tag.getTopArtists":
            return lastfm_response({"topartists": {"artist": [{"name": "Autechre"}]}})
        if method == "tag.getTopAlbums":
            return lastfm_response({"albums": {"album": []}})
        if method == "tag.getTopTracks":
            return lastfm_response(
                {"tracks": {"track": [{"name": "Clipper", "artist": {"name": "Autechre"}}]}}
            )
        if method == "artist.getInfo":
            return lastfm_response({"artist": {"name": "Autechre"}})
        if method == "artist.getTopAlbums":
            return lastfm_response(
                {
                    "topalbums": {
                        "album": [
                            {
                                "name": "Tri Repetae",
                                "image": [{"size": "large", "#text": "http://img/autechre.jpg"}],
                            }
                        ]
                    }
                }
            )
        if method == "track.getInfo":
            return lastfm_response(
                {
                    "track": {
                        "name": "Clipper",
                        "album": {
                            "title": "Tri Repetae",
                            "image": [{"size": "extralarge", "#text": "http://img/clipper.jpg"}],
                        },
                    }
                }
            )
        raise AssertionError(f"unexpected method: {method}")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get("/api/discover/tag/idm")

    assert r.status_code == 200
    body = r.json()
    assert body["topArtists"][0]["imageUrl"] == "https://img/autechre.jpg"
    assert body["topTracks"][0]["imageUrl"] == "https://img/clipper.jpg"


@pytest.mark.asyncio
async def test_discover_tag_ignores_lastfm_placeholder_images(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    placeholder = (
        "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png"
    )

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "tag.getInfo":
            return lastfm_response({"tag": {"name": "ambient"}})
        if method == "tag.getSimilar":
            return lastfm_response({"similartags": {"tag": []}})
        if method == "tag.getTopArtists":
            return lastfm_response(
                {
                    "topartists": {
                        "artist": [
                            {
                                "name": "Burial",
                                "image": [{"size": "extralarge", "#text": placeholder}],
                            }
                        ]
                    }
                }
            )
        if method == "tag.getTopAlbums":
            return lastfm_response({"albums": {"album": []}})
        if method == "tag.getTopTracks":
            return lastfm_response(
                {
                    "tracks": {
                        "track": [
                            {
                                "name": "Archangel",
                                "artist": {"name": "Burial"},
                                "image": [{"size": "extralarge", "#text": placeholder}],
                            }
                        ]
                    }
                }
            )
        if method == "artist.getInfo":
            return lastfm_response(
                {"artist": {"name": "Burial", "image": [{"size": "large", "#text": placeholder}]}}
            )
        if method == "track.getInfo":
            return lastfm_response(
                {
                    "track": {
                        "name": "Archangel",
                        "album": {
                            "title": "Untrue",
                            "image": [{"size": "large", "#text": placeholder}],
                        },
                    }
                }
            )
        raise AssertionError(f"unexpected method: {method}")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get("/api/discover/tag/ambient")

    assert r.status_code == 200
    body = r.json()
    assert body["topArtists"][0]["imageUrl"] is None
    assert body["topTracks"][0]["imageUrl"] is None


@pytest.mark.asyncio
async def test_discover_tag_disabled_without_api_key(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", None)

    r = await client.get("/api/discover/tag/house")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": False,
        "tag": {"name": "house", "summary": None, "reach": None, "total": None},
        "similarTags": [],
        "topArtists": [],
        "topAlbums": [],
        "topTracks": [],
    }
