from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from suno_backend.app.settings import Settings, get_settings


@pytest.fixture(autouse=True)
def reset_settings_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.delenv("SUNO_LAB_MEDIA_ROOT", raising=False)
    monkeypatch.delenv("SUNO_LAB_CORS_ALLOW_ORIGINS", raising=False)
    monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    yield
    get_settings.cache_clear()
    monkeypatch.delenv("SUNO_LAB_MEDIA_ROOT", raising=False)
    monkeypatch.delenv("SUNO_LAB_CORS_ALLOW_ORIGINS", raising=False)
    monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)


def test_get_settings_returns_settings_instance() -> None:
    assert isinstance(get_settings(), Settings)


def test_get_settings_returns_singleton() -> None:
    assert get_settings() is get_settings()


def test_cors_allow_origins_default() -> None:
    assert get_settings().cors_allow_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_cors_allow_origins_env_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "SUNO_LAB_CORS_ALLOW_ORIGINS",
        "https://example.com, https://foo.com",
    )
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.cors_allow_origins == [
        "https://example.com",
        "https://foo.com",
    ]


def test_media_root_is_path() -> None:
    assert isinstance(get_settings().media_root, Path)


def test_media_root_directory_created_on_startup(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SUNO_LAB_MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    from suno_backend.app.main import app

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


def test_elevenlabs_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MUSIC_PROVIDER", "elevenlabs")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "abc123")
    monkeypatch.setenv("ELEVENLABS_OUTPUT_FORMAT", "pcm_44100")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.music_provider == "elevenlabs"
    assert settings.elevenlabs_api_key == "abc123"
    assert settings.elevenlabs_output_format == "pcm_44100"
