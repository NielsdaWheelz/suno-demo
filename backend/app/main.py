from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.app.settings import get_settings

app = FastAPI()


def _mount_media(app: FastAPI) -> None:
    settings = get_settings()
    app.mount(
        "/media",
        StaticFiles(directory=str(settings.media_root), check_dir=False),
        name="media",
    )


_mount_media(app)


@app.on_event("startup")
async def ensure_media_root() -> None:
    settings = get_settings()
    settings.media_root.mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
