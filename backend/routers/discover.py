import asyncio
import copy
import html
import re
import time
from typing import Annotated, Any, Literal

import httpx
from fastapi import APIRouter, Depends, Query

from config import settings
from dependencies import get_http_client, nd_params, nd_unwrap

router = APIRouter(prefix="/api/discover")

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]

LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/"
TAG_CACHE_TTL_SECONDS = 60 * 60 * 12
GLOBAL_CACHE_TTL_SECONDS = 60 * 60
CACHE_VERSION = "v5"
IMAGE_SIZES = ("extralarge", "large", "medium", "small")
SUMMARY_LINK_RE = re.compile(r"<a[^>]*>\s*Read more on Last\.fm\s*</a>", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
LASTFM_PLACEHOLDER_IMAGE_NAMES = {"2a96cbd8b46e442fc41c2b86b821562f.png"}

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def _cache_get(key: str) -> dict[str, Any] | None:
    cached = _CACHE.get(key)
    if not cached:
        return None

    expires_at, value = cached
    if expires_at <= time.monotonic():
        _CACHE.pop(key, None)
        return None

    return copy.deepcopy(value)


def _cache_put(
    key: str, value: dict[str, Any], ttl_seconds: int = TAG_CACHE_TTL_SECONDS
) -> dict[str, Any]:
    _CACHE[key] = (time.monotonic() + ttl_seconds, copy.deepcopy(value))
    return copy.deepcopy(value)


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    return []


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def _parse_count(value: Any) -> int | None:
    try:
        return int(str(value))
    except TypeError, ValueError:
        return None


def _clean_summary(value: Any) -> str | None:
    if not value:
        return None

    text = SUMMARY_LINK_RE.sub("", str(value))
    text = HTML_TAG_RE.sub("", text)
    text = html.unescape(text).strip()
    return text or None


def _normalize_image_url(url: Any) -> str | None:
    value = str(url or "").strip()
    if not value:
        return None
    if value.startswith("http://"):
        value = f"https://{value.removeprefix('http://')}"

    filename = value.rsplit("/", 1)[-1].split("?", 1)[0].casefold()
    if filename in LASTFM_PLACEHOLDER_IMAGE_NAMES:
        return None

    return value


def _extract_image_url(item: dict[str, Any]) -> str | None:
    images = _as_list(item.get("image"))
    for size in IMAGE_SIZES:
        for image in images:
            if image.get("size") == size and image.get("#text"):
                return _normalize_image_url(image["#text"])
    for image in images:
        if image.get("#text"):
            return _normalize_image_url(image["#text"])
    return None


def _extract_track_info_image(data: dict[str, Any] | None) -> str | None:
    track = (data or {}).get("track", {})
    if not isinstance(track, dict):
        return None

    image_url = _extract_image_url(track)
    if image_url:
        return image_url

    album = track.get("album")
    if isinstance(album, dict):
        return _extract_image_url(album)

    return None


def _extract_artist_top_album_image(data: dict[str, Any] | None) -> str | None:
    albums = _as_list((data or {}).get("topalbums", {}).get("album"))
    for album in albums:
        image_url = _extract_image_url(album)
        if image_url:
            return image_url
    return None


def _build_soulseek_query(kind: str, title: str, artist_name: str | None) -> str:
    if kind == "artist":
        return title
    if artist_name:
        return f"{artist_name} {title}"
    return title


def _normalize_tag_item(item: dict[str, Any]) -> dict[str, Any] | None:
    name = str(item.get("name") or "").strip()
    if not name:
        return None

    return {
        "name": name,
        "count": _parse_count(item.get("count") or item.get("taggings")),
        "reach": _parse_count(item.get("reach")),
    }


def _artist_name_from_value(value: Any) -> str | None:
    if isinstance(value, dict):
        name = value.get("name")
    else:
        name = value

    name = str(name or "").strip()
    return name or None


def _make_card(
    kind: str, title: str, artist_name: str | None, item: dict[str, Any]
) -> dict[str, Any]:
    return {
        "kind": kind,
        "title": title,
        "artistName": artist_name,
        "imageUrl": _extract_image_url(item),
        "inLibrary": False,
        "libraryId": None,
        "artistId": None,
        "albumId": None,
        "songId": None,
        "soulseekQuery": _build_soulseek_query(kind, title, artist_name),
    }


def _dedupe_cards(cards: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[dict[str, Any]] = []

    for card in cards:
        key = (
            card["kind"],
            _normalize_text(card.get("artistName")),
            _normalize_text(card.get("title")),
        )
        if not card.get("title") or key in seen:
            continue
        seen.add(key)
        deduped.append(card)
        if len(deduped) >= limit:
            break

    return deduped


def _normalize_artist_cards(data: dict[str, Any] | None, limit: int = 12) -> list[dict[str, Any]]:
    root = (data or {}).get("topartists") or (data or {}).get("artists") or {}
    artists = _as_list(root.get("artist"))
    cards = []
    for artist in artists:
        name = str(artist.get("name") or "").strip()
        if not name:
            continue
        cards.append(_make_card("artist", name, None, artist))
    return _dedupe_cards(cards, limit=limit)


def _normalize_album_cards(data: dict[str, Any] | None, limit: int = 12) -> list[dict[str, Any]]:
    root = (data or {}).get("albums") or (data or {}).get("topalbums") or {}
    albums = _as_list(root.get("album"))
    cards = []
    for album in albums:
        title = str(album.get("name") or "").strip()
        artist_name = _artist_name_from_value(album.get("artist"))
        if not title or not artist_name:
            continue
        cards.append(_make_card("album", title, artist_name, album))
    return _dedupe_cards(cards, limit=limit)


def _normalize_track_cards(data: dict[str, Any] | None, limit: int = 12) -> list[dict[str, Any]]:
    root = (data or {}).get("tracks") or (data or {}).get("toptracks") or {}
    tracks = _as_list(root.get("track"))
    cards = []
    for track in tracks:
        title = str(track.get("name") or "").strip()
        artist_name = _artist_name_from_value(track.get("artist"))
        if not title or not artist_name:
            continue
        cards.append(_make_card("track", title, artist_name, track))
    return _dedupe_cards(cards, limit=limit)


def _disabled_bootstrap_payload() -> dict[str, Any]:
    return {"enabled": False, "topTags": [], "trendingArtists": [], "trendingTracks": []}


def _disabled_chart_payload(kind: str, page: int) -> dict[str, Any]:
    return {"enabled": False, "kind": kind, "page": page, "totalPages": 0, "items": []}


def _disabled_tag_chart_payload(tag_name: str, kind: str, page: int) -> dict[str, Any]:
    return {
        "enabled": False,
        "tag": tag_name,
        "kind": kind,
        "page": page,
        "totalPages": 0,
        "items": [],
    }


def _disabled_tag_payload(tag_name: str) -> dict[str, Any]:
    return {
        "enabled": False,
        "tag": {"name": tag_name, "summary": None, "reach": None, "total": None},
        "similarTags": [],
        "topArtists": [],
        "topAlbums": [],
        "topTracks": [],
    }


def _discover_page_limit(kind: Literal["artists", "albums", "tracks"]) -> int:
    return 20


async def _lastfm_request(
    client: httpx.AsyncClient, method: str, **params: str | int
) -> dict[str, Any] | None:
    if not settings.lastfm_api_key:
        return None

    try:
        response = await client.get(
            LASTFM_BASE_URL,
            params={
                "method": method,
                "api_key": settings.lastfm_api_key,
                "format": "json",
                **params,
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or payload.get("error"):
            return None
        return payload
    except httpx.HTTPError, ValueError:
        return None


async def _search_navidrome(
    client: httpx.AsyncClient,
    query: str,
    *,
    artist_count: int = 0,
    album_count: int = 0,
    song_count: int = 0,
) -> dict[str, Any]:
    response = await client.get(
        f"{settings.navidrome_url}/rest/search3.view",
        params=nd_params(
            query=query,
            artistCount=artist_count,
            albumCount=album_count,
            songCount=song_count,
        ),
        timeout=10,
    )
    response.raise_for_status()
    payload = nd_unwrap(response.json())
    return payload["subsonic-response"].get("searchResult3", {})


def _pick_artist_match(candidates: list[dict[str, Any]], title: str) -> dict[str, Any] | None:
    title_key = _normalize_text(title)
    for candidate in candidates:
        if _normalize_text(candidate.get("name")) == title_key:
            return candidate
    return None


def _pick_album_match(
    candidates: list[dict[str, Any]], title: str, artist_name: str | None
) -> dict[str, Any] | None:
    title_key = _normalize_text(title)
    artist_key = _normalize_text(artist_name)
    for candidate in candidates:
        if _normalize_text(candidate.get("name")) != title_key:
            continue
        if artist_key and _normalize_text(candidate.get("artist")) != artist_key:
            continue
        return candidate
    return None


def _pick_track_match(
    candidates: list[dict[str, Any]], title: str, artist_name: str | None
) -> dict[str, Any] | None:
    title_key = _normalize_text(title)
    artist_key = _normalize_text(artist_name)
    for candidate in candidates:
        if _normalize_text(candidate.get("title")) != title_key:
            continue
        if artist_key and _normalize_text(candidate.get("artist")) != artist_key:
            continue
        return candidate
    return None


async def _resolve_card(client: httpx.AsyncClient, card: dict[str, Any]) -> dict[str, Any]:
    resolved = copy.deepcopy(card)
    query = resolved["title"]
    if resolved.get("artistName"):
        query = f"{resolved['artistName']} {resolved['title']}"

    try:
        if resolved["kind"] == "artist":
            search = await _search_navidrome(client, resolved["title"], artist_count=6)
            match = _pick_artist_match(_as_list(search.get("artist")), resolved["title"])
            if match:
                resolved["inLibrary"] = True
                resolved["libraryId"] = match.get("id")
                resolved["artistId"] = match.get("id")
            return resolved

        if resolved["kind"] == "album":
            search = await _search_navidrome(client, query, album_count=6)
            match = _pick_album_match(
                _as_list(search.get("album")), resolved["title"], resolved.get("artistName")
            )
            if match:
                resolved["inLibrary"] = True
                resolved["libraryId"] = match.get("id")
                resolved["albumId"] = match.get("id")
                resolved["artistId"] = match.get("artistId")
            return resolved

        if resolved["kind"] == "track":
            search = await _search_navidrome(client, query, song_count=6)
            match = _pick_track_match(
                _as_list(search.get("song")), resolved["title"], resolved.get("artistName")
            )
            if match:
                resolved["inLibrary"] = True
                resolved["libraryId"] = match.get("id")
                resolved["songId"] = match.get("id")
                resolved["albumId"] = match.get("albumId")
                resolved["artistId"] = match.get("artistId")
            return resolved
    except Exception:
        return resolved

    return resolved


async def _resolve_cards(
    client: httpx.AsyncClient, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not cards:
        return []
    resolved = await asyncio.gather(*(_resolve_card(client, card) for card in cards))
    return list(resolved)


async def _backfill_card_image(client: httpx.AsyncClient, card: dict[str, Any]) -> dict[str, Any]:
    if card.get("imageUrl"):
        return card

    enriched = copy.deepcopy(card)

    try:
        image_url = None
        if enriched["kind"] == "artist":
            data = await _lastfm_request(
                client, "artist.getInfo", artist=enriched["title"], autocorrect=1
            )
            image_url = _extract_image_url((data or {}).get("artist", {}))
            if not image_url:
                top_albums_data = await _lastfm_request(
                    client,
                    "artist.getTopAlbums",
                    artist=enriched["title"],
                    autocorrect=1,
                    limit=3,
                )
                image_url = _extract_artist_top_album_image(top_albums_data)
        elif enriched["kind"] == "album" and enriched.get("artistName"):
            data = await _lastfm_request(
                client,
                "album.getInfo",
                artist=enriched["artistName"],
                album=enriched["title"],
                autocorrect=1,
            )
            image_url = _extract_image_url((data or {}).get("album", {}))
        elif enriched["kind"] == "track" and enriched.get("artistName"):
            data = await _lastfm_request(
                client,
                "track.getInfo",
                artist=enriched["artistName"],
                track=enriched["title"],
                autocorrect=1,
            )
            image_url = _extract_track_info_image(data)
            if not image_url:
                artist_data = await _lastfm_request(
                    client,
                    "artist.getInfo",
                    artist=enriched["artistName"],
                    autocorrect=1,
                )
                image_url = _extract_image_url((artist_data or {}).get("artist", {}))

        if image_url:
            enriched["imageUrl"] = image_url
    except Exception:
        return enriched

    return enriched


async def _backfill_missing_images(
    client: httpx.AsyncClient, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not cards:
        return []
    enriched = await asyncio.gather(*(_backfill_card_image(client, card) for card in cards))
    return list(enriched)


async def _prepare_cards(
    client: httpx.AsyncClient, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not cards:
        return []

    enriched = await _backfill_missing_images(client, cards)
    return await _resolve_cards(client, enriched)


def _normalize_tag_detail(data: dict[str, Any] | None, raw_tag: str) -> dict[str, Any]:
    tag = (data or {}).get("tag", {})
    wiki = tag.get("wiki") if isinstance(tag.get("wiki"), dict) else {}
    name = str(tag.get("name") or raw_tag).strip() or raw_tag
    return {
        "name": name,
        "summary": _clean_summary(wiki.get("summary")),
        "reach": _parse_count(tag.get("reach")),
        "total": _parse_count(tag.get("total")),
    }


def _normalize_similar_tags(data: dict[str, Any] | None) -> list[dict[str, Any]]:
    tags = _as_list((data or {}).get("similartags", {}).get("tag"))
    normalized = []
    for tag in tags:
        item = _normalize_tag_item(tag)
        if item:
            normalized.append(item)
        if len(normalized) >= 12:
            break
    return normalized


def _normalize_top_tags(data: dict[str, Any] | None, limit: int = 24) -> list[dict[str, Any]]:
    root = (data or {}).get("toptags") or (data or {}).get("tags") or {}
    tags = _as_list(root.get("tag"))
    normalized = []
    for tag in tags:
        item = _normalize_tag_item(tag)
        if item:
            normalized.append(item)
        if len(normalized) >= limit:
            break
    return normalized


def _extract_page_data(root: dict[str, Any], requested_page: int) -> tuple[int, int]:
    attrs = root.get("@attr") if isinstance(root.get("@attr"), dict) else {}

    page = _parse_count(attrs.get("page") or root.get("page")) or requested_page
    total_pages = _parse_count(attrs.get("totalPages") or root.get("totalPages"))
    if total_pages is None:
        total_pages = 0 if not root else 1

    return page, total_pages


def _extract_chart_page(
    data: dict[str, Any] | None, kind: Literal["artists", "tracks"], requested_page: int
) -> tuple[int, int]:
    root = (data or {}).get(kind) or {}
    return _extract_page_data(root, requested_page)


def _extract_tag_chart_page(
    data: dict[str, Any] | None,
    kind: Literal["artists", "albums", "tracks"],
    requested_page: int,
) -> tuple[int, int]:
    root_key = "topartists" if kind == "artists" else "albums" if kind == "albums" else "tracks"
    root = (data or {}).get(root_key) or {}
    return _extract_page_data(root, requested_page)


@router.get("/bootstrap")
async def get_discover_bootstrap(client: HttpClient):
    if not settings.lastfm_api_key:
        return _disabled_bootstrap_payload()

    cached = _cache_get(f"{CACHE_VERSION}:bootstrap")
    if cached:
        return cached

    tags_data, artists_data, tracks_data = await asyncio.gather(
        _lastfm_request(client, "chart.getTopTags", page=1, limit=24),
        _lastfm_request(client, "chart.getTopArtists", page=1, limit=10),
        _lastfm_request(client, "chart.getTopTracks", page=1, limit=10),
    )

    trending_artists, trending_tracks = await asyncio.gather(
        _prepare_cards(client, _normalize_artist_cards(artists_data, limit=10)),
        _prepare_cards(client, _normalize_track_cards(tracks_data, limit=10)),
    )

    payload = {
        "enabled": True,
        "topTags": _normalize_top_tags(tags_data, limit=24),
        "trendingArtists": trending_artists,
        "trendingTracks": trending_tracks,
    }
    return _cache_put(f"{CACHE_VERSION}:bootstrap", payload, ttl_seconds=GLOBAL_CACHE_TTL_SECONDS)


@router.get("/charts")
async def get_discover_charts(
    client: HttpClient,
    kind: Annotated[Literal["artists", "tracks"], Query()] = "artists",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int | None, Query(ge=1, le=24)] = None,
):
    resolved_limit = limit or _discover_page_limit(kind)

    if not settings.lastfm_api_key:
        return _disabled_chart_payload(kind, page)

    cache_key = f"{CACHE_VERSION}:charts:{kind}:{page}:{resolved_limit}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    method = "chart.getTopArtists" if kind == "artists" else "chart.getTopTracks"
    data = await _lastfm_request(client, method, page=page, limit=resolved_limit)
    cards = (
        _normalize_artist_cards(data, limit=resolved_limit)
        if kind == "artists"
        else _normalize_track_cards(data, limit=resolved_limit)
    )
    page_number, total_pages = _extract_chart_page(data, kind, page)
    items = await _prepare_cards(client, cards)

    payload = {
        "enabled": True,
        "kind": kind,
        "page": page_number,
        "totalPages": total_pages,
        "items": items,
    }
    return _cache_put(cache_key, payload, ttl_seconds=GLOBAL_CACHE_TTL_SECONDS)


@router.get("/tag/{tag:path}/charts")
async def get_discover_tag_charts(
    tag: str,
    client: HttpClient,
    kind: Annotated[Literal["artists", "albums", "tracks"], Query()] = "artists",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int | None, Query(ge=1, le=24)] = None,
):
    tag_name = tag.strip()
    resolved_limit = limit or _discover_page_limit(kind)

    if not tag_name:
        return _disabled_tag_chart_payload("", kind, page)

    if not settings.lastfm_api_key:
        return _disabled_tag_chart_payload(tag_name, kind, page)

    cache_key = (
        f"{CACHE_VERSION}:tagcharts:{_normalize_text(tag_name)}:{kind}:{page}:{resolved_limit}"
    )
    cached = _cache_get(cache_key)
    if cached:
        return cached

    method = (
        "tag.getTopArtists"
        if kind == "artists"
        else "tag.getTopAlbums"
        if kind == "albums"
        else "tag.getTopTracks"
    )
    data = await _lastfm_request(client, method, tag=tag_name, page=page, limit=resolved_limit)
    cards = (
        _normalize_artist_cards(data, limit=resolved_limit)
        if kind == "artists"
        else _normalize_album_cards(data, limit=resolved_limit)
        if kind == "albums"
        else _normalize_track_cards(data, limit=resolved_limit)
    )
    page_number, total_pages = _extract_tag_chart_page(data, kind, page)
    items = await _prepare_cards(client, cards)

    payload = {
        "enabled": True,
        "tag": tag_name,
        "kind": kind,
        "page": page_number,
        "totalPages": total_pages,
        "items": items,
    }
    return _cache_put(cache_key, payload, ttl_seconds=TAG_CACHE_TTL_SECONDS)


@router.get("/tag/{tag:path}")
async def get_discover_tag(tag: str, client: HttpClient):
    tag_name = tag.strip()
    if not tag_name:
        return _disabled_tag_payload("")

    if not settings.lastfm_api_key:
        return _disabled_tag_payload(tag_name)

    cache_key = f"{CACHE_VERSION}:tag:{_normalize_text(tag_name)}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    info_data, similar_data, artists_data, albums_data, tracks_data = await asyncio.gather(
        _lastfm_request(client, "tag.getInfo", tag=tag_name),
        _lastfm_request(client, "tag.getSimilar", tag=tag_name),
        _lastfm_request(client, "tag.getTopArtists", tag=tag_name),
        _lastfm_request(client, "tag.getTopAlbums", tag=tag_name),
        _lastfm_request(client, "tag.getTopTracks", tag=tag_name),
    )

    resolved_artists, resolved_albums, resolved_tracks = await asyncio.gather(
        _prepare_cards(client, _normalize_artist_cards(artists_data)),
        _prepare_cards(client, _normalize_album_cards(albums_data)),
        _prepare_cards(client, _normalize_track_cards(tracks_data)),
    )

    payload = {
        "enabled": True,
        "tag": _normalize_tag_detail(info_data, tag_name),
        "similarTags": _normalize_similar_tags(similar_data),
        "topArtists": resolved_artists,
        "topAlbums": resolved_albums,
        "topTracks": resolved_tracks,
    }
    return _cache_put(cache_key, payload, ttl_seconds=TAG_CACHE_TTL_SECONDS)
