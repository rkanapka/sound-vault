import os

# Must be set before importing app modules so pydantic-settings can read them
os.environ.setdefault("NAVIDROME_USER", "testuser")
os.environ.setdefault("NAVIDROME_PASS", "testpass")

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport  # noqa: E402

from main import app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    # ASGITransport doesn't trigger lifespan, so set up app.state manually
    async with httpx.AsyncClient() as http_client:
        app.state.http_client = http_client
        app.state.slskd_client = http_client
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
