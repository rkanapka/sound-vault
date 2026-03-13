import asyncio
import copy
from typing import Any

import httpx

from config import settings
from dependencies import nd_params, nd_unwrap

from .constants import LASTFM_BASE_URL
from .shared import (
    artist_name_from_value,
    as_list,
    dedupe_cards,
    extract_artist_top_album_image,
    extract_image_url,
    extract_track_info_image,
    make_card,
    normalize_text,
)


async def lastfm_request(
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


async def search_navidrome(
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


def pick_artist_match(candidates: list[dict[str, Any]], title: str) -> dict[str, Any] | None:
    title_key = normalize_text(title)
    for candidate in candidates:
        if normalize_text(candidate.get("name")) == title_key:
            return candidate
    return None


def pick_album_match(
    candidates: list[dict[str, Any]], title: str, artist_name: str | None
) -> dict[str, Any] | None:
    title_key = normalize_text(title)
    artist_key = normalize_text(artist_name)
    for candidate in candidates:
        if normalize_text(candidate.get("name")) != title_key:
            continue
        if artist_key and normalize_text(candidate.get("artist")) != artist_key:
            continue
        return candidate
    return None


def pick_track_match(
    candidates: list[dict[str, Any]], title: str, artist_name: str | None
) -> dict[str, Any] | None:
    title_key = normalize_text(title)
    artist_key = normalize_text(artist_name)
    for candidate in candidates:
        if normalize_text(candidate.get("title")) != title_key:
            continue
        if artist_key and normalize_text(candidate.get("artist")) != artist_key:
            continue
        return candidate
    return None


async def resolve_card(client: httpx.AsyncClient, card: dict[str, Any]) -> dict[str, Any]:
    resolved = copy.deepcopy(card)
    query = resolved["title"]
    if resolved.get("artistName"):
        query = f"{resolved['artistName']} {resolved['title']}"

    try:
        if resolved["kind"] == "artist":
            search = await search_navidrome(client, resolved["title"], artist_count=6)
            match = pick_artist_match(as_list(search.get("artist")), resolved["title"])
            if match:
                resolved["inLibrary"] = True
                resolved["libraryId"] = match.get("id")
                resolved["artistId"] = match.get("id")
            return resolved

        if resolved["kind"] == "album":
            search = await search_navidrome(client, query, album_count=6)
            match = pick_album_match(
                as_list(search.get("album")), resolved["title"], resolved.get("artistName")
            )
            if match:
                resolved["inLibrary"] = True
                resolved["libraryId"] = match.get("id")
                resolved["albumId"] = match.get("id")
                resolved["artistId"] = match.get("artistId")
            return resolved

        if resolved["kind"] == "track":
            search = await search_navidrome(client, query, song_count=6)
            match = pick_track_match(
                as_list(search.get("song")), resolved["title"], resolved.get("artistName")
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


async def resolve_cards(
    client: httpx.AsyncClient, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not cards:
        return []
    resolved = await asyncio.gather(*(resolve_card(client, card) for card in cards))
    return list(resolved)


async def backfill_card_image(
    client: httpx.AsyncClient,
    card: dict[str, Any],
    *,
    allow_artist_top_album_fallback: bool = True,
) -> dict[str, Any]:
    if card.get("imageUrl"):
        return card

    enriched = copy.deepcopy(card)

    try:
        image_url = None
        if enriched["kind"] == "artist":
            data = await lastfm_request(
                client, "artist.getInfo", artist=enriched["title"], autocorrect=1
            )
            image_url = extract_image_url((data or {}).get("artist", {}))
            if not image_url and allow_artist_top_album_fallback:
                top_albums_data = await lastfm_request(
                    client,
                    "artist.getTopAlbums",
                    artist=enriched["title"],
                    autocorrect=1,
                    limit=3,
                )
                image_url = extract_artist_top_album_image(top_albums_data)
        elif enriched["kind"] == "album" and enriched.get("artistName"):
            data = await lastfm_request(
                client,
                "album.getInfo",
                artist=enriched["artistName"],
                album=enriched["title"],
                autocorrect=1,
            )
            image_url = extract_image_url((data or {}).get("album", {}))
        elif enriched["kind"] == "track" and enriched.get("artistName"):
            data = await lastfm_request(
                client,
                "track.getInfo",
                artist=enriched["artistName"],
                track=enriched["title"],
                autocorrect=1,
            )
            image_url = extract_track_info_image(data)
            if not image_url:
                artist_data = await lastfm_request(
                    client,
                    "artist.getInfo",
                    artist=enriched["artistName"],
                    autocorrect=1,
                )
                image_url = extract_image_url((artist_data or {}).get("artist", {}))

        if image_url:
            enriched["imageUrl"] = image_url
    except Exception:
        return enriched

    return enriched


async def backfill_missing_images(
    client: httpx.AsyncClient, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not cards:
        return []
    enriched = await asyncio.gather(*(backfill_card_image(client, card) for card in cards))
    return list(enriched)


async def prepare_cards(
    client: httpx.AsyncClient, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not cards:
        return []

    enriched = await backfill_missing_images(client, cards)
    return await resolve_cards(client, enriched)


def normalize_similar_artist_cards(data: dict[str, Any] | None, limit: int = 12):
    artists = as_list((data or {}).get("similarartists", {}).get("artist"))
    cards = []
    for artist in artists:
        title = str(artist.get("name") or "").strip()
        if title:
            cards.append(make_card("artist", title, None, artist))

    return dedupe_cards(cards, limit=limit)


def normalize_similar_track_cards(data: dict[str, Any] | None, limit: int = 12):
    tracks = as_list((data or {}).get("similartracks", {}).get("track"))
    cards = []
    for track in tracks:
        title = str(track.get("name") or "").strip()
        artist_name = artist_name_from_value(track.get("artist"))
        if title and artist_name:
            cards.append(make_card("track", title, artist_name, track))

    return dedupe_cards(cards, limit=limit)
