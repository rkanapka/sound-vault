from fastapi import APIRouter

from .albums import router as albums_router
from .artists import router as artists_router
from .favorites import router as favorites_router
from .files import router as files_router
from .maintenance import router as maintenance_router
from .media import router as media_router
from .playlists import router as playlists_router
from .search import router as search_router
from .songs import router as songs_router

router = APIRouter(prefix="/api/library")
router.include_router(artists_router)
router.include_router(albums_router)
router.include_router(search_router)
router.include_router(songs_router)
router.include_router(media_router)
router.include_router(maintenance_router)
router.include_router(files_router)
router.include_router(playlists_router)
router.include_router(favorites_router)
