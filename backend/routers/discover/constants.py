import re

LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/"
TAG_CACHE_TTL_SECONDS = 60 * 60 * 12
GLOBAL_CACHE_TTL_SECONDS = 60 * 60
CACHE_VERSION = "v6"
IMAGE_SIZES = ("extralarge", "large", "medium", "small")
SUMMARY_LINK_RE = re.compile(r"<a[^>]*>\s*Read more on Last\.fm\s*</a>", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
LASTFM_PLACEHOLDER_IMAGE_NAMES = {"2a96cbd8b46e442fc41c2b86b821562f.png"}
DETAIL_TAG_LIMIT = 8
DETAIL_SECTION_LIMIT = 12
