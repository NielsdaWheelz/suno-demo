from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.sessions import router as sessions_router
from backend.app.settings import Settings, get_settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _mask(value: str | None) -> str:
    if not value:
        return "unset"
    if len(value) <= 6:
        return "***"
    return f"{value[:3]}***{value[-3:]}"


def _log_settings(settings: Settings) -> None:
    logger.info(
        "settings resolved: media_root=%s music_provider=%s use_fake_namer=%s "
        "clap_enabled=%s elevenlabs_output_format=%s elevenlabs_api_key=%s",
        settings.media_root,
        settings.music_provider,
        settings.use_fake_namer,
        settings.clap_enabled,
        getattr(settings, "elevenlabs_output_format", "unset"),
        _mask(getattr(settings, "elevenlabs_api_key", None)),
    )

def _mount_media(app: FastAPI) -> None:
    settings = get_settings()
    _log_settings(settings)
    settings.media_root.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_root), name="media")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_mount_media(app)
app.include_router(sessions_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": exc.errors()})


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        # "media_root": str(get_settings()),
    }