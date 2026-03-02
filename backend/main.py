from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routers import library, soulseek


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient()
    yield
    await app.state.http_client.aclose()


app = FastAPI(lifespan=lifespan)

app.include_router(library.router)
app.include_router(soulseek.router)


@app.exception_handler(httpx.ConnectError)
async def connect_error_handler(request: Request, exc: httpx.ConnectError):
    raise HTTPException(status_code=503, detail=f"Cannot reach backend service: {exc}")


@app.exception_handler(httpx.TimeoutException)
async def timeout_handler(request: Request, exc: httpx.TimeoutException):
    raise HTTPException(status_code=504, detail=f"Backend service timed out: {exc}")


@app.exception_handler(httpx.HTTPStatusError)
async def http_status_error_handler(request: Request, exc: httpx.HTTPStatusError):
    raise HTTPException(status_code=502, detail=f"Upstream error: {exc.response.status_code}")


_static = Path(__file__).parent / "static"
if _static.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(_static / "index.html"))
