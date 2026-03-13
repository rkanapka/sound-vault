import asyncio
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, Query

from config import settings
from dependencies import get_http_client

from .cache import cache_get, cache_put
from .cards import lastfm_request, prepare_cards
from .constants import CACHE_VERSION, GLOBAL_CACHE_TTL_SECONDS, TAG_CACHE_TTL_SECONDS
from .detail import build_album_detail, build_artist_detail, build_track_detail, resolve_seed_card
from .shared import (
    disabled_bootstrap_payload,
    disabled_chart_payload,
    disabled_tag_chart_payload,
    disabled_tag_payload,
    discover_page_limit,
    empty_detail_payload,
    extract_chart_page,
    extract_tag_chart_page,
    normalize_album_cards,
    normalize_artist_cards,
    normalize_similar_tags,
    normalize_tag_detail,
    normalize_text,
    normalize_top_tags,
    normalize_track_cards,
)

router = APIRouter(prefix="/api/discover")

HttpClient = Annotated[httpx.AsyncClient, Depends(get_http_client)]


@router.get("/bootstrap")
async def get_discover_bootstrap(client: HttpClient):
    if not settings.lastfm_api_key:
        return disabled_bootstrap_payload()

    cached = cache_get(f"{CACHE_VERSION}:bootstrap")
    if cached:
        return cached

    tags_data, artists_data, tracks_data = await asyncio.gather(
        lastfm_request(client, "chart.getTopTags", page=1, limit=24),
        lastfm_request(client, "chart.getTopArtists", page=1, limit=10),
        lastfm_request(client, "chart.getTopTracks", page=1, limit=10),
    )

    trending_artists, trending_tracks = await asyncio.gather(
        prepare_cards(client, normalize_artist_cards(artists_data, limit=10)),
        prepare_cards(client, normalize_track_cards(tracks_data, limit=10)),
    )

    payload = {
        "enabled": True,
        "topTags": normalize_top_tags(tags_data, limit=24),
        "trendingArtists": trending_artists,
        "trendingTracks": trending_tracks,
    }
    return cache_put(f"{CACHE_VERSION}:bootstrap", payload, ttl_seconds=GLOBAL_CACHE_TTL_SECONDS)


@router.get("/charts")
async def get_discover_charts(
    client: HttpClient,
    kind: Annotated[Literal["artists", "tracks"], Query()] = "artists",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int | None, Query(ge=1, le=24)] = None,
):
    resolved_limit = limit or discover_page_limit(kind)

    if not settings.lastfm_api_key:
        return disabled_chart_payload(kind, page)

    cache_key = f"{CACHE_VERSION}:charts:{kind}:{page}:{resolved_limit}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    method = "chart.getTopArtists" if kind == "artists" else "chart.getTopTracks"
    data = await lastfm_request(client, method, page=page, limit=resolved_limit)
    cards = (
        normalize_artist_cards(data, limit=resolved_limit)
        if kind == "artists"
        else normalize_track_cards(data, limit=resolved_limit)
    )
    page_number, total_pages = extract_chart_page(data, kind, page)
    items = await prepare_cards(client, cards)

    payload = {
        "enabled": True,
        "kind": kind,
        "page": page_number,
        "totalPages": total_pages,
        "items": items,
    }
    return cache_put(cache_key, payload, ttl_seconds=GLOBAL_CACHE_TTL_SECONDS)


@router.get("/tag/{tag:path}/charts")
async def get_discover_tag_charts(
    tag: str,
    client: HttpClient,
    kind: Annotated[Literal["artists", "albums", "tracks"], Query()] = "artists",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int | None, Query(ge=1, le=24)] = None,
):
    tag_name = tag.strip()
    resolved_limit = limit or discover_page_limit(kind)

    if not tag_name:
        return disabled_tag_chart_payload("", kind, page)

    if not settings.lastfm_api_key:
        return disabled_tag_chart_payload(tag_name, kind, page)

    cache_key = (
        f"{CACHE_VERSION}:tagcharts:{normalize_text(tag_name)}:{kind}:{page}:{resolved_limit}"
    )
    cached = cache_get(cache_key)
    if cached:
        return cached

    method = (
        "tag.getTopArtists"
        if kind == "artists"
        else "tag.getTopAlbums"
        if kind == "albums"
        else "tag.getTopTracks"
    )
    data = await lastfm_request(client, method, tag=tag_name, page=page, limit=resolved_limit)
    cards = (
        normalize_artist_cards(data, limit=resolved_limit)
        if kind == "artists"
        else normalize_album_cards(data, limit=resolved_limit)
        if kind == "albums"
        else normalize_track_cards(data, limit=resolved_limit)
    )
    page_number, total_pages = extract_tag_chart_page(data, kind, page)
    items = await prepare_cards(client, cards)

    payload = {
        "enabled": True,
        "tag": tag_name,
        "kind": kind,
        "page": page_number,
        "totalPages": total_pages,
        "items": items,
    }
    return cache_put(cache_key, payload, ttl_seconds=TAG_CACHE_TTL_SECONDS)


@router.get("/tag/{tag:path}")
async def get_discover_tag(tag: str, client: HttpClient):
    tag_name = tag.strip()
    if not tag_name:
        return disabled_tag_payload("")

    if not settings.lastfm_api_key:
        return disabled_tag_payload(tag_name)

    cache_key = f"{CACHE_VERSION}:tag:{normalize_text(tag_name)}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    info_data, similar_data, artists_data, albums_data, tracks_data = await asyncio.gather(
        lastfm_request(client, "tag.getInfo", tag=tag_name),
        lastfm_request(client, "tag.getSimilar", tag=tag_name),
        lastfm_request(client, "tag.getTopArtists", tag=tag_name),
        lastfm_request(client, "tag.getTopAlbums", tag=tag_name),
        lastfm_request(client, "tag.getTopTracks", tag=tag_name),
    )

    resolved_artists, resolved_albums, resolved_tracks = await asyncio.gather(
        prepare_cards(client, normalize_artist_cards(artists_data)),
        prepare_cards(client, normalize_album_cards(albums_data)),
        prepare_cards(client, normalize_track_cards(tracks_data)),
    )

    payload = {
        "enabled": True,
        "tag": normalize_tag_detail(info_data, tag_name),
        "similarTags": normalize_similar_tags(similar_data),
        "topArtists": resolved_artists,
        "topAlbums": resolved_albums,
        "topTracks": resolved_tracks,
    }
    return cache_put(cache_key, payload, ttl_seconds=TAG_CACHE_TTL_SECONDS)


@router.get("/detail")
async def get_discover_detail(
    client: HttpClient,
    kind: Annotated[Literal["artist", "album", "track"], Query()],
    title: Annotated[str, Query(min_length=1)],
    artistName: Annotated[str | None, Query()] = None,
    artistId: Annotated[str | None, Query()] = None,
    albumId: Annotated[str | None, Query()] = None,
    songId: Annotated[str | None, Query()] = None,
):
    normalized_title = title.strip()
    normalized_artist_name = artistName.strip() if isinstance(artistName, str) else None
    if not normalized_title:
        return empty_detail_payload(kind, "", normalized_artist_name)

    if not settings.lastfm_api_key:
        return empty_detail_payload(kind, normalized_title, normalized_artist_name)

    cache_key = ":".join(
        [
            CACHE_VERSION,
            "detail",
            kind,
            normalize_text(normalized_title),
            normalize_text(normalized_artist_name),
            str(artistId or ""),
            str(albumId or ""),
            str(songId or ""),
        ]
    )
    cached = cache_get(cache_key)
    if cached:
        return cached

    seed_card = await resolve_seed_card(
        client,
        kind,
        normalized_title,
        normalized_artist_name,
        artist_id=artistId,
        album_id=albumId,
        song_id=songId,
    )

    if kind == "artist":
        payload = await build_artist_detail(client, normalized_title, seed_card)
    elif kind == "album":
        payload = await build_album_detail(
            client, normalized_title, normalized_artist_name, seed_card
        )
    else:
        payload = await build_track_detail(
            client, normalized_title, normalized_artist_name, seed_card
        )

    return cache_put(cache_key, payload, ttl_seconds=GLOBAL_CACHE_TTL_SECONDS)
