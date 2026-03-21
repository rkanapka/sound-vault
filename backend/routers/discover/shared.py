import copy
import html
from typing import Any, Literal

from .constants import (
    DETAIL_SECTION_LIMIT,
    DETAIL_TAG_LIMIT,
    DISCOVER_PAGE_LIMITS,
    HTML_TAG_RE,
    IMAGE_SIZES,
    LASTFM_PLACEHOLDER_IMAGE_NAMES,
    SUMMARY_LINK_RE,
    TAG_CHART_ROOT,
)


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    return []


def normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def parse_count(value: Any) -> int | None:
    try:
        return int(str(value))
    except TypeError, ValueError:
        return None


def clean_summary(value: Any) -> str | None:
    if not value:
        return None

    text = SUMMARY_LINK_RE.sub("", str(value))
    text = HTML_TAG_RE.sub("", text)
    text = html.unescape(text).strip()
    return text or None


def normalize_image_url(url: Any) -> str | None:
    value = str(url or "").strip()
    if not value:
        return None
    if value.startswith("http://"):
        value = f"https://{value.removeprefix('http://')}"

    filename = value.rsplit("/", 1)[-1].split("?", 1)[0].casefold()
    if filename in LASTFM_PLACEHOLDER_IMAGE_NAMES:
        return None

    return value


def extract_image_url(item: dict[str, Any]) -> str | None:
    images = as_list(item.get("image"))
    for size in IMAGE_SIZES:
        for image in images:
            if image.get("size") == size and image.get("#text"):
                return normalize_image_url(image["#text"])
    for image in images:
        if image.get("#text"):
            return normalize_image_url(image["#text"])
    return None


def extract_track_info_image(data: dict[str, Any] | None) -> str | None:
    track = (data or {}).get("track", {})
    if not isinstance(track, dict):
        return None

    image_url = extract_image_url(track)
    if image_url:
        return image_url

    album = track.get("album")
    if isinstance(album, dict):
        return extract_image_url(album)

    return None


def extract_artist_top_album_image(data: dict[str, Any] | None) -> str | None:
    albums = as_list((data or {}).get("topalbums", {}).get("album"))
    for album in albums:
        image_url = extract_image_url(album)
        if image_url:
            return image_url
    return None


def build_soulseek_query(kind: str, title: str, artist_name: str | None) -> str:
    if kind == "artist":
        return title
    if artist_name:
        return f"{artist_name} {title}"
    return title


def normalize_tag_item(item: dict[str, Any]) -> dict[str, Any] | None:
    name = str(item.get("name") or "").strip()
    if not name:
        return None

    return {
        "name": name,
        "count": parse_count(item.get("count") or item.get("taggings")),
        "reach": parse_count(item.get("reach")),
    }


def artist_name_from_value(value: Any) -> str | None:
    if isinstance(value, dict):
        name = value.get("name")
    else:
        name = value

    name = str(name or "").strip()
    return name or None


def make_card(
    kind: str, title: str, artist_name: str | None, item: dict[str, Any]
) -> dict[str, Any]:
    return {
        "kind": kind,
        "title": title,
        "artistName": artist_name,
        "imageUrl": extract_image_url(item),
        "inLibrary": False,
        "libraryId": None,
        "artistId": None,
        "albumId": None,
        "songId": None,
        "soulseekQuery": build_soulseek_query(kind, title, artist_name),
    }


def card_key(card: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(card.get("kind") or "").strip(),
        normalize_text(card.get("artistName")),
        normalize_text(card.get("title")),
    )


def dedupe_cards(
    cards: list[dict[str, Any]], limit: int = DETAIL_SECTION_LIMIT
) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[dict[str, Any]] = []

    for card in cards:
        key = card_key(card)
        if not card.get("title") or key in seen:
            continue
        seen.add(key)
        deduped.append(card)
        if len(deduped) >= limit:
            break

    return deduped


def normalize_artist_cards(
    data: dict[str, Any] | None, limit: int = DETAIL_SECTION_LIMIT
) -> list[dict[str, Any]]:
    root = (data or {}).get("topartists") or (data or {}).get("artists") or {}
    artists = as_list(root.get("artist"))
    cards = []
    for artist in artists:
        name = str(artist.get("name") or "").strip()
        if not name:
            continue
        cards.append(make_card("artist", name, None, artist))
    return dedupe_cards(cards, limit=limit)


def normalize_album_cards(
    data: dict[str, Any] | None, limit: int = DETAIL_SECTION_LIMIT
) -> list[dict[str, Any]]:
    root = (data or {}).get("albums") or (data or {}).get("topalbums") or {}
    albums = as_list(root.get("album"))
    cards = []
    for album in albums:
        title = str(album.get("name") or "").strip()
        artist_name = artist_name_from_value(album.get("artist"))
        if not title or not artist_name:
            continue
        cards.append(make_card("album", title, artist_name, album))
    return dedupe_cards(cards, limit=limit)


def normalize_track_cards(
    data: dict[str, Any] | None, limit: int = DETAIL_SECTION_LIMIT
) -> list[dict[str, Any]]:
    root = (data or {}).get("tracks") or (data or {}).get("toptracks") or {}
    tracks = as_list(root.get("track"))
    cards = []
    for track in tracks:
        title = str(track.get("name") or "").strip()
        artist_name = artist_name_from_value(track.get("artist"))
        if not title or not artist_name:
            continue
        cards.append(make_card("track", title, artist_name, track))
    return dedupe_cards(cards, limit=limit)


def disabled_bootstrap_payload() -> dict[str, Any]:
    return {"enabled": False, "topTags": [], "trendingArtists": [], "trendingTracks": []}


def disabled_chart_payload(kind: str, page: int) -> dict[str, Any]:
    return {"enabled": False, "kind": kind, "page": page, "totalPages": 0, "items": []}


def disabled_tag_chart_payload(tag_name: str, kind: str, page: int) -> dict[str, Any]:
    return {
        "enabled": False,
        "tag": tag_name,
        "kind": kind,
        "page": page,
        "totalPages": 0,
        "items": [],
    }


def disabled_tag_payload(tag_name: str) -> dict[str, Any]:
    return {
        "enabled": False,
        "tag": {"name": tag_name, "summary": None, "reach": None, "total": None},
        "similarTags": [],
        "topArtists": [],
        "topAlbums": [],
        "topTracks": [],
    }


def discover_page_limit(kind: Literal["artists", "albums", "tracks"]) -> int:
    return DISCOVER_PAGE_LIMITS[kind]


def normalize_tag_detail(data: dict[str, Any] | None, raw_tag: str) -> dict[str, Any]:
    tag = (data or {}).get("tag", {})
    wiki = tag.get("wiki") if isinstance(tag.get("wiki"), dict) else {}
    name = str(tag.get("name") or raw_tag).strip() or raw_tag
    return {
        "name": name,
        "summary": clean_summary(wiki.get("summary")),
        "reach": parse_count(tag.get("reach")),
        "total": parse_count(tag.get("total")),
    }


def normalize_similar_tags(data: dict[str, Any] | None) -> list[dict[str, Any]]:
    tags = as_list((data or {}).get("similartags", {}).get("tag"))
    normalized = []
    for tag in tags:
        item = normalize_tag_item(tag)
        if item:
            normalized.append(item)
        if len(normalized) >= 12:
            break
    return normalized


def normalize_top_tags(data: dict[str, Any] | None, limit: int = 24) -> list[dict[str, Any]]:
    root = (data or {}).get("toptags") or (data or {}).get("tags") or {}
    tags = as_list(root.get("tag"))
    normalized = []
    for tag in tags:
        item = normalize_tag_item(tag)
        if item:
            normalized.append(item)
        if len(normalized) >= limit:
            break
    return normalized


def extract_entity_tags(
    entity: dict[str, Any] | None, limit: int = DETAIL_TAG_LIMIT
) -> list[dict[str, Any]]:
    if not isinstance(entity, dict):
        return []

    root = entity.get("tags") if isinstance(entity.get("tags"), dict) else entity.get("toptags")
    if not isinstance(root, dict):
        return []

    normalized = []
    for tag in as_list(root.get("tag")):
        item = normalize_tag_item(tag)
        if item:
            normalized.append(item)
        else:
            name = str(tag.get("name") or "").strip()
            if name:
                normalized.append({"name": name, "count": None, "reach": None})
        if len(normalized) >= limit:
            break
    return normalized


def extract_entity_summary(entity: dict[str, Any] | None) -> str | None:
    if not isinstance(entity, dict):
        return None

    for key in ("wiki", "bio"):
        block = entity.get(key)
        if isinstance(block, dict):
            summary = clean_summary(block.get("summary") or block.get("content"))
            if summary:
                return summary
    return None


def extract_native_image(item: dict[str, Any] | None, image_key: str | None = None) -> str | None:
    if not isinstance(item, dict):
        return None

    if image_key and item.get(image_key):
        return normalize_image_url(item.get(image_key))

    for field in ("largeImageUrl", "mediumImageUrl", "smallImageUrl"):
        if item.get(field):
            return normalize_image_url(item.get(field))
    return None


def detail_library_payload(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "inLibrary": bool(card.get("inLibrary")),
        "libraryId": card.get("libraryId"),
        "artistId": card.get("artistId"),
        "albumId": card.get("albumId"),
        "songId": card.get("songId"),
    }


def empty_detail_payload(
    kind: Literal["artist", "album", "track"], title: str, artist_name: str | None
) -> dict[str, Any]:
    return {
        "enabled": False,
        "kind": kind,
        "title": title,
        "artistName": artist_name,
        "imageUrl": None,
        "summary": None,
        "tags": [],
        "library": {
            "inLibrary": False,
            "libraryId": None,
            "artistId": None,
            "albumId": None,
            "songId": None,
        },
        "artist": None,
        "tracks": [],
        "topAlbums": [],
        "topTracks": [],
        "similarArtists": [],
        "relatedAlbums": [],
        "canonicalAlbum": None,
        "localAlbumMatches": [],
        "similarTracks": [],
    }


def build_detail_payload(
    kind: Literal["artist", "album", "track"],
    title: str,
    artist_name: str | None,
    card: dict[str, Any],
) -> dict[str, Any]:
    payload = empty_detail_payload(kind, title, artist_name)
    payload["enabled"] = True
    payload["kind"] = kind
    payload["title"] = title
    payload["artistName"] = artist_name
    payload["imageUrl"] = card.get("imageUrl")
    payload["library"] = detail_library_payload(card)
    return payload


def apply_known_library_ids(
    card: dict[str, Any],
    *,
    artist_id: str | None = None,
    album_id: str | None = None,
    song_id: str | None = None,
) -> dict[str, Any]:
    resolved = copy.deepcopy(card)
    if not any((artist_id, album_id, song_id)):
        return resolved

    resolved["inLibrary"] = True
    if artist_id:
        resolved["artistId"] = artist_id
    if album_id:
        resolved["albumId"] = album_id
    if song_id:
        resolved["songId"] = song_id

    resolved["libraryId"] = song_id or album_id or artist_id
    return resolved


def normalize_track_number(value: Any) -> int | None:
    if isinstance(value, dict):
        return parse_count(value.get("rank"))
    return parse_count(value)


def normalize_detail_track_item(
    track: dict[str, Any],
    *,
    default_artist_name: str | None,
    default_album_title: str | None,
    default_artist_id: str | None = None,
    default_album_id: str | None = None,
) -> dict[str, Any] | None:
    title = str(track.get("title") or track.get("name") or "").strip()
    artist_name = artist_name_from_value(track.get("artist")) or default_artist_name
    if not title:
        return None

    item = make_card("track", title, artist_name, track)
    item = apply_known_library_ids(
        item,
        artist_id=track.get("artistId") or default_artist_id,
        album_id=track.get("albumId") or default_album_id,
        song_id=track.get("id"),
    )
    item["trackNumber"] = normalize_track_number(track.get("track") or track.get("@attr"))
    item["duration"] = parse_count(track.get("duration"))
    item["albumTitle"] = str(track.get("album") or default_album_title or "").strip() or None
    return item


def normalize_detail_tracks(
    tracks: list[dict[str, Any]],
    *,
    default_artist_name: str | None,
    default_album_title: str | None,
    default_artist_id: str | None = None,
    default_album_id: str | None = None,
    limit: int = 64,
) -> list[dict[str, Any]]:
    normalized = []
    for track in tracks:
        item = normalize_detail_track_item(
            track,
            default_artist_name=default_artist_name,
            default_album_title=default_album_title,
            default_artist_id=default_artist_id,
            default_album_id=default_album_id,
        )
        if item:
            normalized.append(item)
        if len(normalized) >= limit:
            break
    return normalized


def filter_cards_excluding(
    cards: list[dict[str, Any]],
    *,
    exclude: set[tuple[str, str, str]],
    limit: int = DETAIL_SECTION_LIMIT,
) -> list[dict[str, Any]]:
    filtered = []
    seen = set(exclude)
    for card in cards:
        key = card_key(card)
        if key in seen or not card.get("title"):
            continue
        seen.add(key)
        filtered.append(card)
        if len(filtered) >= limit:
            break
    return filtered


def extract_page_data(root: dict[str, Any], requested_page: int) -> tuple[int, int]:
    attrs = root.get("@attr") if isinstance(root.get("@attr"), dict) else {}

    page = parse_count(attrs.get("page") or root.get("page")) or requested_page
    total_pages = parse_count(attrs.get("totalPages") or root.get("totalPages"))
    if total_pages is None:
        total_pages = 0 if not root else 1

    return page, total_pages


def extract_chart_page(
    data: dict[str, Any] | None, kind: Literal["artists", "tracks"], requested_page: int
) -> tuple[int, int]:
    root = (data or {}).get(kind) or {}
    return extract_page_data(root, requested_page)


def extract_tag_chart_page(
    data: dict[str, Any] | None,
    kind: Literal["artists", "albums", "tracks"],
    requested_page: int,
) -> tuple[int, int]:
    root_key = TAG_CHART_ROOT[kind]
    root = (data or {}).get(root_key) or {}
    return extract_page_data(root, requested_page)
