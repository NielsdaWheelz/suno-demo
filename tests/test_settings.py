from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.settings import Settings, get_settings


@pytest.fixture(autouse=True)
def reset_settings_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.delenv("SUNO_LAB_MEDIA_ROOT", raising=False)
    yield
    get_settings.cache_clear()
    monkeypatch.delenv("SUNO_LAB_MEDIA_ROOT", raising=False)


def test_get_settings_returns_settings_instance() -> None:
    assert isinstance(get_settings(), Settings)


def test_get_settings_returns_singleton() -> None:
    assert get_settings() is get_settings()


def test_media_root_is_path() -> None:
    assert isinstance(get_settings().media_root, Path)


def test_media_root_directory_created_on_startup(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SUNO_LAB_MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    from backend.app.main import app

    with TestClient(app):
        settings = get_settings()
        assert settings.media_root == tmp_path
        assert settings.media_root.exists()
        assert settings.media_root.is_dir()


def test_media_root_env_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUNO_LAB_MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.media_root == tmp_path
