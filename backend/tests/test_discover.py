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
    discover_router.clear_cache()
    yield
    discover_router.clear_cache()


@pytest.mark.asyncio
async def test_discover_bootstrap_disabled_without_api_key(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", None)

    r = await client.get("/api/discover/bootstrap")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": False,
        "topTags": [],
        "trendingArtists": [],
        "trendingTracks": [],
    }


@pytest.mark.asyncio
async def test_discover_bootstrap_returns_global_sections(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "chart.getTopTags":
            return lastfm_response(
                {
                    "tags": {
                        "tag": [
                            {"name": "electronic", "taggings": "1200", "reach": "800"},
                            {"name": "ambient", "taggings": "900", "reach": "600"},
                        ]
                    }
                }
            )
        if method == "chart.getTopArtists":
            return lastfm_response(
                {
                    "artists": {
                        "artist": [
                            {
                                "name": "Radiohead",
                                "image": [{"size": "large", "#text": "https://img/rh.jpg"}],
                            },
                            {"name": "Burial"},
                        ]
                    }
                }
            )
        if method == "chart.getTopTracks":
            return lastfm_response(
                {
                    "tracks": {
                        "track": [
                            {
                                "name": "Archangel",
                                "artist": {"name": "Burial"},
                                "image": [{"size": "large", "#text": "https://img/ar.jpg"}],
                            }
                        ]
                    }
                }
            )
        if method == "artist.getInfo":
            return lastfm_response({"artist": {"name": request.url.params["artist"]}})
        if method == "artist.getTopAlbums":
            return lastfm_response(
                {
                    "topalbums": {
                        "album": [
                            {
                                "name": "Untrue",
                                "image": [{"size": "large", "#text": "http://img/burial.jpg"}],
                            }
                        ]
                    }
                }
            )
        raise AssertionError(f"unexpected method: {method}")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get("/api/discover/bootstrap")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": True,
        "topTags": [
            {"name": "electronic", "count": 1200, "reach": 800},
            {"name": "ambient", "count": 900, "reach": 600},
        ],
        "trendingArtists": [
            {
                "kind": "artist",
                "title": "Radiohead",
                "artistName": None,
                "imageUrl": "https://img/rh.jpg",
                "inLibrary": False,
                "libraryId": None,
                "artistId": None,
                "albumId": None,
                "songId": None,
                "soulseekQuery": "Radiohead",
            },
            {
                "kind": "artist",
                "title": "Burial",
                "artistName": None,
                "imageUrl": "https://img/burial.jpg",
                "inLibrary": False,
                "libraryId": None,
                "artistId": None,
                "albumId": None,
                "songId": None,
                "soulseekQuery": "Burial",
            },
        ],
        "trendingTracks": [
            {
                "kind": "track",
                "title": "Archangel",
                "artistName": "Burial",
                "imageUrl": "https://img/ar.jpg",
                "inLibrary": False,
                "libraryId": None,
                "artistId": None,
                "albumId": None,
                "songId": None,
                "soulseekQuery": "Burial Archangel",
            }
        ],
    }


@pytest.mark.asyncio
async def test_discover_bootstrap_survives_partial_lastfm_failure(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "chart.getTopTags":
            return lastfm_response({"tags": {"tag": [{"name": "rock", "reach": "100"}]}})
        if method == "chart.getTopArtists":
            return lastfm_response({"artists": {"artist": [{"name": "Blur"}]}})
        if method == "chart.getTopTracks":
            return httpx.Response(500, text="upstream failure")
        if method == "artist.getInfo":
            return lastfm_response({"artist": {"name": "Blur"}})
        if method == "artist.getTopAlbums":
            return lastfm_response({"topalbums": {"album": []}})
        raise AssertionError(f"unexpected method: {method}")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get("/api/discover/bootstrap")

    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["topTags"] == [{"name": "rock", "count": None, "reach": 100}]
    assert body["trendingArtists"][0]["title"] == "Blur"
    assert body["trendingTracks"] == []


@pytest.mark.asyncio
async def test_discover_charts_returns_paginated_items_and_library_matches(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "chart.getTopTracks":
            assert request.url.params["page"] == "2"
            assert request.url.params["limit"] == "2"
            return lastfm_response(
                {
                    "tracks": {
                        "@attr": {"page": "2", "totalPages": "7"},
                        "track": [
                            {
                                "name": "Everything In Its Right Place",
                                "artist": {"name": "Radiohead"},
                                "image": [{"size": "large", "#text": "https://img/eiirp.jpg"}],
                            },
                            {
                                "name": "Windowlicker",
                                "artist": {"name": "Aphex Twin"},
                                "image": [{"size": "large", "#text": "https://img/wl.jpg"}],
                            },
                        ],
                    }
                }
            )
        raise AssertionError(f"unexpected method: {method}")

    def navidrome_search_handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["query"]
        if query == "Radiohead Everything In Its Right Place":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "song": [
                            {
                                "id": "song-1",
                                "title": "Everything In Its Right Place",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                                "albumId": "album-1",
                            }
                        ]
                    }
                ),
            )
        return httpx.Response(200, json=nd_ok(searchResult3={}))

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(side_effect=navidrome_search_handler)
        r = await client.get("/api/discover/charts?kind=tracks&page=2&limit=2")

    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["kind"] == "tracks"
    assert body["page"] == 2
    assert body["totalPages"] == 7
    assert body["items"][0]["inLibrary"] is True
    assert body["items"][0]["songId"] == "song-1"
    assert body["items"][0]["albumId"] == "album-1"
    assert body["items"][1]["inLibrary"] is False


@pytest.mark.asyncio
async def test_discover_charts_disabled_without_api_key(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", None)

    r = await client.get("/api/discover/charts?kind=artists&page=3")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": False,
        "kind": "artists",
        "page": 3,
        "totalPages": 0,
        "items": [],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("kind", "expected_limit", "payload"),
    [
        (
            "artists",
            "20",
            {
                "artists": {
                    "@attr": {"page": "1", "totalPages": "9"},
                    "artist": [{"name": "Burial"}],
                }
            },
        ),
        (
            "tracks",
            "20",
            {
                "tracks": {
                    "@attr": {"page": "1", "totalPages": "9"},
                    "track": [{"name": "Angel", "artist": {"name": "Massive Attack"}}],
                }
            },
        ),
    ],
)
async def test_discover_charts_default_limit_depends_on_kind(
    client, monkeypatch, kind, expected_limit, payload
):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["limit"] == expected_limit
        return lastfm_response(payload)

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get(f"/api/discover/charts?kind={kind}&page=1")

    assert r.status_code == 200
    assert r.json()["kind"] == kind


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("kind", "method", "payload", "expected_title"),
    [
        (
            "artists",
            "tag.getTopArtists",
            {
                "topartists": {
                    "@attr": {"page": "2", "totalPages": "7"},
                    "artist": [
                        {
                            "name": "Burial",
                            "image": [{"size": "large", "#text": "https://img/burial.jpg"}],
                        },
                        {
                            "name": "Massive Attack",
                            "image": [{"size": "large", "#text": "https://img/ma.jpg"}],
                        },
                    ],
                }
            },
            "Burial",
        ),
        (
            "albums",
            "tag.getTopAlbums",
            {
                "albums": {
                    "@attr": {"page": "2", "totalPages": "7"},
                    "album": [
                        {
                            "name": "Mezzanine",
                            "artist": {"name": "Massive Attack"},
                            "image": [{"size": "large", "#text": "https://img/mezz.jpg"}],
                        },
                        {
                            "name": "Dummy",
                            "artist": {"name": "Portishead"},
                            "image": [{"size": "large", "#text": "https://img/dummy.jpg"}],
                        },
                    ],
                }
            },
            "Mezzanine",
        ),
        (
            "tracks",
            "tag.getTopTracks",
            {
                "tracks": {
                    "@attr": {"page": "2", "totalPages": "7"},
                    "track": [
                        {
                            "name": "Angel",
                            "artist": {"name": "Massive Attack"},
                            "image": [{"size": "large", "#text": "https://img/angel.jpg"}],
                        },
                        {
                            "name": "Roads",
                            "artist": {"name": "Portishead"},
                            "image": [{"size": "large", "#text": "https://img/roads.jpg"}],
                        },
                    ],
                }
            },
            "Angel",
        ),
    ],
)
async def test_discover_tag_charts_returns_paginated_items(
    client, monkeypatch, kind, method, payload, expected_title
):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["method"] == method
        assert request.url.params["tag"] == "trip-hop"
        assert request.url.params["page"] == "2"
        assert request.url.params["limit"] == "2"
        return lastfm_response(payload)

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get(f"/api/discover/tag/trip-hop/charts?kind={kind}&page=2&limit=2")

    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["tag"] == "trip-hop"
    assert body["kind"] == kind
    assert body["page"] == 2
    assert body["totalPages"] == 7
    assert len(body["items"]) == 2
    assert body["items"][0]["title"] == expected_title


@pytest.mark.asyncio
async def test_discover_tag_charts_survive_partial_lastfm_failure(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["method"] == "tag.getTopTracks"
        return httpx.Response(500, text="upstream failure")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        r = await client.get("/api/discover/tag/ambient/charts?kind=tracks&page=2&limit=12")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": True,
        "tag": "ambient",
        "kind": "tracks",
        "page": 2,
        "totalPages": 0,
        "items": [],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("kind", "expected_limit", "payload"),
    [
        (
            "artists",
            "20",
            {
                "topartists": {
                    "@attr": {"page": "1", "totalPages": "6"},
                    "artist": [{"name": "Burial"}],
                }
            },
        ),
        (
            "albums",
            "20",
            {
                "albums": {
                    "@attr": {"page": "1", "totalPages": "6"},
                    "album": [{"name": "Mezzanine", "artist": {"name": "Massive Attack"}}],
                }
            },
        ),
        (
            "tracks",
            "20",
            {
                "tracks": {
                    "@attr": {"page": "1", "totalPages": "6"},
                    "track": [{"name": "Angel", "artist": {"name": "Massive Attack"}}],
                }
            },
        ),
    ],
)
async def test_discover_tag_charts_default_limit_depends_on_kind(
    client, monkeypatch, kind, expected_limit, payload
):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["tag"] == "trip-hop"
        assert request.url.params["limit"] == expected_limit
        return lastfm_response(payload)

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )
        r = await client.get(f"/api/discover/tag/trip-hop/charts?kind={kind}&page=1")

    assert r.status_code == 200
    assert r.json()["kind"] == kind


@pytest.mark.asyncio
async def test_discover_tag_charts_disabled_without_api_key(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", None)

    r = await client.get("/api/discover/tag/house/charts?kind=albums&page=3")

    assert r.status_code == 200
    assert r.json() == {
        "enabled": False,
        "tag": "house",
        "kind": "albums",
        "page": 3,
        "totalPages": 0,
        "items": [],
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


@pytest.mark.asyncio
async def test_discover_artist_detail_prefers_library_metadata_and_resolves_sections(
    client, monkeypatch
):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "artist.getInfo":
            return lastfm_response(
                {
                    "artist": {
                        "name": "Radiohead",
                        "tags": {"tag": [{"name": "alternative", "count": "100"}]},
                        "bio": {"summary": "Last.fm summary"},
                        "image": [{"size": "large", "#text": "https://img/radiohead-lastfm.jpg"}],
                    }
                }
            )
        if method == "artist.getTopAlbums":
            return lastfm_response(
                {
                    "topalbums": {
                        "album": [
                            {"name": "OK Computer", "artist": {"name": "Radiohead"}},
                            {"name": "Kid A", "artist": {"name": "Radiohead"}},
                        ]
                    }
                }
            )
        if method == "artist.getTopTracks":
            return lastfm_response(
                {
                    "toptracks": {
                        "track": [{"name": "Paranoid Android", "artist": {"name": "Radiohead"}}]
                    }
                }
            )
        if method == "artist.getSimilar":
            return lastfm_response(
                {
                    "similarartists": {
                        "artist": [
                            {
                                "name": "Blur",
                                "image": [{"size": "large", "#text": "https://img/blur.jpg"}],
                            }
                        ]
                    }
                }
            )
        raise AssertionError(f"unexpected method: {method}")

    def navidrome_search_handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["query"]
        if query == "Radiohead OK Computer":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "album": [
                            {
                                "id": "album-1",
                                "name": "OK Computer",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                            }
                        ]
                    }
                ),
            )
        if query == "Radiohead Kid A":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "album": [
                            {
                                "id": "album-2",
                                "name": "Kid A",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                            }
                        ]
                    }
                ),
            )
        if query == "Radiohead Paranoid Android":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "song": [
                            {
                                "id": "song-1",
                                "title": "Paranoid Android",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                                "albumId": "album-1",
                            }
                        ]
                    }
                ),
            )
        if query == "Blur":
            return httpx.Response(
                200,
                json=nd_ok(searchResult3={"artist": [{"id": "artist-2", "name": "Blur"}]}),
            )
        return httpx.Response(200, json=nd_ok(searchResult3={}))

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(side_effect=navidrome_search_handler)
        respx.get(f"{ND_BASE}/rest/getArtist.view").mock(
            return_value=httpx.Response(
                200, json=nd_ok(artist={"id": "artist-1", "name": "Radiohead"})
            )
        )
        respx.post(f"{ND_BASE}/auth/login").mock(
            return_value=httpx.Response(200, json={"token": "tok"})
        )
        respx.get(f"{ND_BASE}/api/artist/artist-1").mock(
            return_value=httpx.Response(
                200,
                json={
                    "biography": "Native biography",
                    "largeImageUrl": "https://img/radiohead-native.jpg",
                },
            )
        )

        r = await client.get(
            "/api/discover/detail",
            params={"kind": "artist", "title": "Radiohead", "artistId": "artist-1"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["title"] == "Radiohead"
    assert body["summary"] == "Native biography"
    assert body["imageUrl"] == "https://img/radiohead-native.jpg"
    assert body["tags"] == [{"name": "alternative", "count": 100, "reach": None}]
    assert body["library"] == {
        "inLibrary": True,
        "libraryId": "artist-1",
        "artistId": "artist-1",
        "albumId": None,
        "songId": None,
    }
    assert body["topAlbums"][0]["albumId"] == "album-1"
    assert body["topTracks"][0]["songId"] == "song-1"
    assert body["similarArtists"][0]["artistId"] == "artist-2"


@pytest.mark.asyncio
async def test_discover_album_detail_uses_local_tracks_and_dedupes_related_albums(
    client, monkeypatch
):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "album.getInfo":
            return lastfm_response(
                {
                    "album": {
                        "name": "OK Computer",
                        "artist": "Radiohead",
                        "tags": {"tag": [{"name": "art rock"}, {"name": "alternative"}]},
                        "wiki": {"summary": "Last.fm album summary"},
                        "tracks": {
                            "track": [
                                {
                                    "name": "Airbag",
                                    "artist": {"name": "Radiohead"},
                                    "@attr": {"rank": "1"},
                                }
                            ]
                        },
                    }
                }
            )
        if method == "artist.getTopAlbums":
            return lastfm_response(
                {
                    "topalbums": {
                        "album": [
                            {"name": "OK Computer", "artist": {"name": "Radiohead"}},
                            {"name": "Kid A", "artist": {"name": "Radiohead"}},
                        ]
                    }
                }
            )
        if method == "tag.getTopAlbums":
            tag = request.url.params["tag"]
            if tag == "art rock":
                return lastfm_response(
                    {
                        "albums": {
                            "album": [
                                {"name": "OK Computer", "artist": {"name": "Radiohead"}},
                                {"name": "Mezzanine", "artist": {"name": "Massive Attack"}},
                            ]
                        }
                    }
                )
            if tag == "alternative":
                return lastfm_response(
                    {"albums": {"album": [{"name": "Kid A", "artist": {"name": "Radiohead"}}]}}
                )
            raise AssertionError(f"unexpected tag: {tag}")
        raise AssertionError(f"unexpected method: {method}")

    def navidrome_search_handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["query"]
        if query == "Radiohead Kid A":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "album": [
                            {
                                "id": "album-2",
                                "name": "Kid A",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                            }
                        ]
                    }
                ),
            )
        if query == "Massive Attack Mezzanine":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "album": [
                            {
                                "id": "album-3",
                                "name": "Mezzanine",
                                "artist": "Massive Attack",
                                "artistId": "artist-2",
                            }
                        ]
                    }
                ),
            )
        return httpx.Response(200, json=nd_ok(searchResult3={}))

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(side_effect=navidrome_search_handler)
        respx.get(f"{ND_BASE}/rest/getAlbum.view").mock(
            return_value=httpx.Response(
                200,
                json=nd_ok(
                    album={
                        "id": "album-1",
                        "name": "OK Computer",
                        "artist": "Radiohead",
                        "artistId": "artist-1",
                        "song": [
                            {
                                "id": "song-10",
                                "title": "Airbag",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                                "albumId": "album-1",
                                "track": 1,
                                "duration": 276,
                            },
                            {
                                "id": "song-11",
                                "title": "Paranoid Android",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                                "albumId": "album-1",
                                "track": 2,
                                "duration": 385,
                            },
                        ],
                    }
                ),
            )
        )
        respx.post(f"{ND_BASE}/auth/login").mock(
            return_value=httpx.Response(200, json={"token": "tok"})
        )
        respx.get(f"{ND_BASE}/api/album/album-1").mock(
            return_value=httpx.Response(
                200,
                json={
                    "description": "Native album description",
                    "largeImageUrl": "https://img/okc-native.jpg",
                },
            )
        )

        r = await client.get(
            "/api/discover/detail",
            params={
                "kind": "album",
                "title": "OK Computer",
                "artistName": "Radiohead",
                "albumId": "album-1",
                "artistId": "artist-1",
            },
        )

    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == "Native album description"
    assert body["imageUrl"] == "https://img/okc-native.jpg"
    assert [track["title"] for track in body["tracks"]] == ["Airbag", "Paranoid Android"]
    assert [track["songId"] for track in body["tracks"]] == ["song-10", "song-11"]
    assert [album["title"] for album in body["relatedAlbums"]] == ["Kid A", "Mezzanine"]


@pytest.mark.asyncio
async def test_discover_track_detail_survives_similar_failure_and_excludes_canonical_album(
    client, monkeypatch
):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        if method == "track.getInfo":
            return lastfm_response(
                {
                    "track": {
                        "name": "Creep",
                        "artist": {"name": "Radiohead"},
                        "wiki": {"summary": "Track summary"},
                        "toptags": {"tag": [{"name": "britpop"}]},
                        "album": {
                            "title": "Pablo Honey",
                            "image": [{"size": "large", "#text": "https://img/pablo.jpg"}],
                        },
                    }
                }
            )
        if method == "track.getSimilar":
            return httpx.Response(500, text="upstream failure")
        raise AssertionError(f"unexpected method: {method}")

    def navidrome_search_handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["query"]
        if query == "Radiohead Creep":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "song": [
                            {
                                "id": "song-1",
                                "title": "Creep",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                                "album": "Pablo Honey",
                                "albumId": "album-1",
                            },
                            {
                                "id": "song-2",
                                "title": "Creep",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                                "album": "Best Of Radiohead",
                                "albumId": "album-2",
                            },
                        ]
                    }
                ),
            )
        if query == "Radiohead Pablo Honey":
            return httpx.Response(
                200,
                json=nd_ok(
                    searchResult3={
                        "album": [
                            {
                                "id": "album-1",
                                "name": "Pablo Honey",
                                "artist": "Radiohead",
                                "artistId": "artist-1",
                            }
                        ]
                    }
                ),
            )
        return httpx.Response(200, json=nd_ok(searchResult3={}))

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(side_effect=navidrome_search_handler)
        respx.get(f"{ND_BASE}/rest/getSong.view").mock(
            return_value=httpx.Response(
                200,
                json=nd_ok(
                    song={
                        "id": "song-1",
                        "title": "Creep",
                        "artist": "Radiohead",
                        "artistId": "artist-1",
                        "album": "Pablo Honey",
                        "albumId": "album-1",
                    }
                ),
            )
        )

        r = await client.get(
            "/api/discover/detail",
            params={
                "kind": "track",
                "title": "Creep",
                "artistName": "Radiohead",
                "songId": "song-1",
                "artistId": "artist-1",
            },
        )

    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == "Track summary"
    assert body["canonicalAlbum"]["title"] == "Pablo Honey"
    assert [album["title"] for album in body["localAlbumMatches"]] == ["Best Of Radiohead"]
    assert body["similarTracks"] == []


@pytest.mark.asyncio
async def test_discover_detail_uses_cache_for_identical_requests(client, monkeypatch):
    monkeypatch.setattr(discover_router.settings, "lastfm_api_key", "test-key")
    calls = {
        "artist.getInfo": 0,
        "artist.getTopAlbums": 0,
        "artist.getTopTracks": 0,
        "artist.getSimilar": 0,
    }

    def lastfm_handler(request: httpx.Request) -> httpx.Response:
        method = request.url.params["method"]
        calls[method] += 1
        if method == "artist.getInfo":
            return lastfm_response({"artist": {"name": "Burial"}})
        if method == "artist.getTopAlbums":
            return lastfm_response({"topalbums": {"album": []}})
        if method == "artist.getTopTracks":
            return lastfm_response({"toptracks": {"track": []}})
        if method == "artist.getSimilar":
            return lastfm_response({"similarartists": {"artist": []}})
        raise AssertionError(f"unexpected method: {method}")

    with respx.mock:
        respx.get(LASTFM_BASE).mock(side_effect=lastfm_handler)
        respx.get(f"{ND_BASE}/rest/search3.view").mock(
            return_value=httpx.Response(200, json=nd_ok(searchResult3={}))
        )

        first = await client.get(
            "/api/discover/detail", params={"kind": "artist", "title": "Burial"}
        )
        second = await client.get(
            "/api/discover/detail", params={"kind": "artist", "title": "Burial"}
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert calls == {
        "artist.getInfo": 2,
        "artist.getTopAlbums": 1,
        "artist.getTopTracks": 1,
        "artist.getSimilar": 1,
    }
