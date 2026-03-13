import copy
import time
from typing import Any

from .constants import TAG_CACHE_TTL_SECONDS

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def cache_get(key: str) -> dict[str, Any] | None:
    cached = _CACHE.get(key)
    if not cached:
        return None

    expires_at, value = cached
    if expires_at <= time.monotonic():
        _CACHE.pop(key, None)
        return None

    return copy.deepcopy(value)


def cache_put(
    key: str, value: dict[str, Any], ttl_seconds: int = TAG_CACHE_TTL_SECONDS
) -> dict[str, Any]:
    _CACHE[key] = (time.monotonic() + ttl_seconds, copy.deepcopy(value))
    return copy.deepcopy(value)


def clear_cache() -> None:
    _CACHE.clear()
