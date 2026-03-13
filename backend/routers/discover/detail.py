import asyncio
from typing import Any

import httpx

from config import settings
from dependencies import nd_params, nd_unwrap
from routers.library.native import get_native_item

from .cards import (
    backfill_card_image,
    lastfm_request,
    normalize_similar_artist_cards,
    normalize_similar_track_cards,
    pick_track_match,
    prepare_cards,
    resolve_card,
    search_navidrome,
)
from .constants import DETAIL_SECTION_LIMIT
from .shared import (
    apply_known_library_ids,
    artist_name_from_value,
    as_list,
    build_detail_payload,
    card_key,
    dedupe_cards,
    empty_detail_payload,
    extract_artist_top_album_image,
    extract_entity_summary,
    extract_entity_tags,
    extract_image_url,
    extract_native_image,
    extract_track_info_image,
    filter_cards_excluding,
    make_card,
    normalize_album_cards,
    normalize_detail_tracks,
    normalize_text,
    normalize_track_cards,
)


async def safe_search_navidrome(
    client: httpx.AsyncClient,
    query: str,
    *,
    artist_count: int = 0,
    album_count: int = 0,
    song_count: int = 0,
) -> dict[str, Any]:
    try:
        return await search_navidrome(
            client,
            query,
            artist_count=artist_count,
            album_count=album_count,
            song_count=song_count,
        )
    except Exception:
        return {}


async def navidrome_view(
    client: httpx.AsyncClient, endpoint: str, root_key: str, **params: str
) -> dict[str, Any] | None:
    try:
        response = await client.get(
            f"{settings.navidrome_url}/rest/{endpoint}.view",
            params=nd_params(**params),
            timeout=10,
        )
        response.raise_for_status()
        payload = nd_unwrap(response.json())
        item = payload["subsonic-response"].get(root_key)
        return item if isinstance(item, dict) else None
    except Exception:
        return None


async def get_library_artist(
    client: httpx.AsyncClient, artist_id: str | None
) -> dict[str, Any] | None:
    if not artist_id:
        return None

    artist = await navidrome_view(client, "getArtist", "artist", id=artist_id)
    native_artist = await get_native_item(client, f"/api/artist/{artist_id}")
    if artist and native_artist:
        image_url = extract_native_image(native_artist)
        if native_artist.get("biography"):
            artist["biography"] = native_artist["biography"]
        if image_url:
            artist["artistImageUrl"] = image_url
        for field in ("smallImageUrl", "mediumImageUrl", "largeImageUrl", "externalInfoUpdatedAt"):
            if native_artist.get(field):
                artist[field] = native_artist[field]
    return artist


async def get_library_album(
    client: httpx.AsyncClient, album_id: str | None
) -> dict[str, Any] | None:
    if not album_id:
        return None

    album = await navidrome_view(client, "getAlbum", "album", id=album_id)
    native_album = await get_native_item(client, f"/api/album/{album_id}")
    if album and native_album:
        if native_album.get("description"):
            album["description"] = native_album["description"]
        for field in ("smallImageUrl", "mediumImageUrl", "largeImageUrl", "externalInfoUpdatedAt"):
            if native_album.get(field):
                album[field] = native_album[field]
    return album


async def get_library_song(client: httpx.AsyncClient, song_id: str | None) -> dict[str, Any] | None:
    if not song_id:
        return None
    return await navidrome_view(client, "getSong", "song", id=song_id)


async def resolve_seed_card(
    client: httpx.AsyncClient,
    kind: str,
    title: str,
    artist_name: str | None,
    *,
    artist_id: str | None = None,
    album_id: str | None = None,
    song_id: str | None = None,
) -> dict[str, Any]:
    card = make_card(kind, title, artist_name, {})
    card = apply_known_library_ids(card, artist_id=artist_id, album_id=album_id, song_id=song_id)
    allow_artist_top_album_fallback = kind != "artist"
    if card.get("inLibrary"):
        return await backfill_card_image(
            client,
            card,
            allow_artist_top_album_fallback=allow_artist_top_album_fallback,
        )
    return await resolve_card(
        client,
        await backfill_card_image(
            client,
            card,
            allow_artist_top_album_fallback=allow_artist_top_album_fallback,
        ),
    )


def make_artist_card(
    name: str | None, *, artist_id: str | None = None, image_url: str | None = None
) -> dict[str, Any] | None:
    title = str(name or "").strip()
    if not title:
        return None

    card = make_card("artist", title, None, {})
    if image_url:
        card["imageUrl"] = image_url
    return apply_known_library_ids(card, artist_id=artist_id)


def make_album_card(
    title: str | None,
    artist_name: str | None,
    *,
    artist_id: str | None = None,
    album_id: str | None = None,
    image_url: str | None = None,
) -> dict[str, Any] | None:
    normalized_title = str(title or "").strip()
    if not normalized_title:
        return None

    card = make_card("album", normalized_title, artist_name, {})
    if image_url:
        card["imageUrl"] = image_url
    return apply_known_library_ids(card, artist_id=artist_id, album_id=album_id)


def collect_track_album_cards(
    search_result: dict[str, Any], title: str, artist_name: str | None
) -> list[dict[str, Any]]:
    cards = []
    songs = as_list(search_result.get("song"))
    for song in songs:
        if not pick_track_match([song], title, artist_name):
            continue
        album_title = str(song.get("album") or "").strip()
        if not album_title:
            continue
        card = make_album_card(
            album_title,
            artist_name_from_value(song.get("artist")),
            artist_id=song.get("artistId"),
            album_id=song.get("albumId"),
        )
        if card:
            cards.append(card)
    return dedupe_cards(cards, limit=DETAIL_SECTION_LIMIT)


async def build_related_album_cards(
    client: httpx.AsyncClient, title: str, artist_name: str | None, tags: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    artist_albums_data = await lastfm_request(
        client,
        "artist.getTopAlbums",
        artist=artist_name or "",
        autocorrect=1,
        limit=8,
    )
    tag_names = [tag["name"] for tag in tags[:3] if tag.get("name")]
    tag_albums_data = await asyncio.gather(
        *(
            lastfm_request(client, "tag.getTopAlbums", tag=tag_name, limit=6)
            for tag_name in tag_names
        )
    )

    cards = normalize_album_cards(artist_albums_data, limit=8)
    for data in tag_albums_data:
        cards.extend(normalize_album_cards(data, limit=6))

    exclude = {("album", normalize_text(artist_name), normalize_text(title))}
    related_cards = filter_cards_excluding(cards, exclude=exclude, limit=DETAIL_SECTION_LIMIT)
    return await prepare_cards(client, related_cards)


async def build_artist_detail(
    client: httpx.AsyncClient, title: str, card: dict[str, Any]
) -> dict[str, Any]:
    (
        library_artist,
        info_data,
        top_albums_data,
        top_tracks_data,
        similar_data,
    ) = await asyncio.gather(
        get_library_artist(client, card.get("artistId")),
        lastfm_request(client, "artist.getInfo", artist=title, autocorrect=1),
        lastfm_request(client, "artist.getTopAlbums", artist=title, autocorrect=1, limit=12),
        lastfm_request(client, "artist.getTopTracks", artist=title, autocorrect=1, limit=12),
        lastfm_request(client, "artist.getSimilar", artist=title, autocorrect=1, limit=12),
    )

    artist_data = (info_data or {}).get("artist", {})
    display_title = (
        str(artist_data.get("name") or (library_artist or {}).get("name") or title).strip() or title
    )
    payload = build_detail_payload("artist", display_title, None, card)

    payload["summary"] = (library_artist or {}).get("biography") or extract_entity_summary(
        artist_data
    )
    payload["tags"] = extract_entity_tags(artist_data)
    payload["imageUrl"] = (
        extract_native_image(library_artist, "artistImageUrl")
        or extract_image_url(artist_data)
        or payload["imageUrl"]
        or extract_artist_top_album_image(top_albums_data)
    )

    top_albums, top_tracks, similar_artists = await asyncio.gather(
        prepare_cards(client, normalize_album_cards(top_albums_data, limit=12)),
        prepare_cards(client, normalize_track_cards(top_tracks_data, limit=12)),
        prepare_cards(client, normalize_similar_artist_cards(similar_data, limit=12)),
    )
    payload["topAlbums"] = top_albums
    payload["topTracks"] = top_tracks
    payload["similarArtists"] = similar_artists
    return payload


async def build_album_detail(
    client: httpx.AsyncClient, title: str, artist_name: str | None, card: dict[str, Any]
) -> dict[str, Any]:
    library_album, info_data = await asyncio.gather(
        get_library_album(client, card.get("albumId")),
        lastfm_request(
            client,
            "album.getInfo",
            artist=artist_name or "",
            album=title,
            autocorrect=1,
        ),
    )

    album_data = (info_data or {}).get("album", {})
    display_title = str(
        album_data.get("name") or (library_album or {}).get("name") or title
    ).strip()
    resolved_artist_name = (
        artist_name_from_value(album_data.get("artist"))
        or (library_album or {}).get("artist")
        or artist_name
    )
    payload = build_detail_payload("album", display_title or title, resolved_artist_name, card)

    payload["summary"] = (library_album or {}).get("description") or extract_entity_summary(
        album_data
    )
    payload["tags"] = extract_entity_tags(album_data)
    payload["imageUrl"] = (
        extract_native_image(library_album) or extract_image_url(album_data) or payload["imageUrl"]
    )

    artist_card = make_artist_card(
        resolved_artist_name,
        artist_id=(library_album or {}).get("artistId") or card.get("artistId"),
    )
    if artist_card:
        payload["artist"] = await resolve_card(client, artist_card)

    if isinstance(library_album, dict) and as_list(library_album.get("song")):
        payload["tracks"] = normalize_detail_tracks(
            as_list(library_album.get("song")),
            default_artist_name=resolved_artist_name,
            default_album_title=display_title or title,
            default_artist_id=(library_album or {}).get("artistId") or card.get("artistId"),
            default_album_id=(library_album or {}).get("id") or card.get("albumId"),
        )
    else:
        payload["tracks"] = normalize_detail_tracks(
            as_list((album_data.get("tracks") or {}).get("track")),
            default_artist_name=resolved_artist_name,
            default_album_title=display_title or title,
            default_artist_id=card.get("artistId"),
            default_album_id=card.get("albumId"),
        )

    payload["relatedAlbums"] = await build_related_album_cards(
        client, display_title or title, resolved_artist_name, payload["tags"]
    )
    return payload


async def build_track_detail(
    client: httpx.AsyncClient, title: str, artist_name: str | None, card: dict[str, Any]
) -> dict[str, Any]:
    library_song = await get_library_song(client, card.get("songId"))
    resolved_artist_name = (
        artist_name or (library_song or {}).get("artist") or card.get("artistName")
    )

    info_data, similar_data, local_search = await asyncio.gather(
        lastfm_request(
            client,
            "track.getInfo",
            artist=resolved_artist_name or "",
            track=title,
            autocorrect=1,
        ),
        lastfm_request(
            client,
            "track.getSimilar",
            artist=resolved_artist_name or "",
            track=title,
            autocorrect=1,
            limit=12,
        ),
        safe_search_navidrome(
            client,
            f"{resolved_artist_name or ''} {title}".strip(),
            album_count=12,
            song_count=24,
        ),
    )

    track_data = (info_data or {}).get("track", {})
    display_title = str(
        track_data.get("name") or (library_song or {}).get("title") or title
    ).strip()
    resolved_artist_name = (
        artist_name_from_value(track_data.get("artist")) or resolved_artist_name or artist_name
    )
    payload = build_detail_payload("track", display_title or title, resolved_artist_name, card)
    payload["summary"] = extract_entity_summary(track_data)
    payload["tags"] = extract_entity_tags(track_data)
    payload["imageUrl"] = extract_track_info_image(info_data) or payload["imageUrl"]

    artist_card = make_artist_card(resolved_artist_name, artist_id=card.get("artistId"))
    if artist_card:
        payload["artist"] = await resolve_card(client, artist_card)

    canonical_album_data = (
        track_data.get("album") if isinstance(track_data.get("album"), dict) else {}
    )
    canonical_album_title = str(canonical_album_data.get("title") or "").strip()
    if canonical_album_title:
        canonical_album_card = make_album_card(
            canonical_album_title,
            resolved_artist_name,
            image_url=extract_image_url(canonical_album_data),
        )
        if canonical_album_card:
            prepared_canonical = await prepare_cards(client, [canonical_album_card])
            payload["canonicalAlbum"] = prepared_canonical[0] if prepared_canonical else None

    local_album_matches = collect_track_album_cards(
        local_search, display_title or title, resolved_artist_name
    )
    if isinstance(library_song, dict) and library_song.get("album"):
        library_album_card = make_album_card(
            library_song.get("album"),
            library_song.get("artist"),
            artist_id=library_song.get("artistId"),
            album_id=library_song.get("albumId"),
        )
        if library_album_card:
            local_album_matches.insert(0, library_album_card)

    local_album_matches = dedupe_cards(local_album_matches, limit=DETAIL_SECTION_LIMIT)
    exclude = {card_key(payload["canonicalAlbum"])} if payload.get("canonicalAlbum") else set()
    payload["localAlbumMatches"] = filter_cards_excluding(
        local_album_matches, exclude=exclude, limit=DETAIL_SECTION_LIMIT
    )
    payload["similarTracks"] = await prepare_cards(
        client, normalize_similar_track_cards(similar_data, limit=12)
    )
    return payload


__all__ = [
    "build_album_detail",
    "build_artist_detail",
    "build_track_detail",
    "empty_detail_payload",
    "resolve_seed_card",
]
