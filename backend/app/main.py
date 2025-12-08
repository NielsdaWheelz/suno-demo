from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.app.settings import get_settings

def _mount_media(app: FastAPI) -> None:
    settings = get_settings()
    app.mount(
        "/media",
        StaticFiles(directory=str(settings.media_root), check_dir=False),
        name="media",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(lifespan=lifespan)
_mount_media(app)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
