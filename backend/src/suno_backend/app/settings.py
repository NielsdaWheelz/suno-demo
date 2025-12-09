from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from pydantic import AliasChoices, Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _project_root() -> Path:
    """Find the backend project root (where pyproject.toml lives), else cwd."""
    for candidate in Path(__file__).resolve().parents:
        if (candidate / "pyproject.toml").exists():
            return candidate
    return Path.cwd()


BASE_DIR = _project_root()


def _parse_origins(value: str | list[str] | None) -> list[str]:
    if value is None:
        raise ValueError("cors_allow_origins_raw must be set via env")
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            maybe_json = json.loads(value)
            if isinstance(maybe_json, list):
                return [origin.strip() for origin in maybe_json if str(origin).strip()]
        except json.JSONDecodeError:
            pass
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    raise TypeError("cors_allow_origins must be a string or list")


class Settings(BaseSettings):
    media_root: Path = BASE_DIR / "media"
    max_batch_size: int = 6
    default_max_k: int = 3
    min_similarity: float = 0.3
    cors_allow_origins_raw: str | None = Field(
        default=None,
        alias=AliasChoices(
            "SUNO_LAB_CORS_ALLOW_ORIGINS",
            "SUNO_LAB_ALLOWED_ORIGINS",
            "CORS_ALLOW_ORIGINS",
            "ALLOWED_ORIGINS",
        ),
    )
    music_provider: str = Field(
        default="fake",
        validation_alias=AliasChoices("MUSIC_PROVIDER", "suno_lab_music_provider"),
    )
    openai_api_key: str | None = None
    elevenlabs_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "ELEVENLABS_API_KEY", "xi_api_key", "suno_lab_elevenlabs_api_key"
        ),
    )
    elevenlabs_output_format: str = Field(
        default="pcm_44100",
        validation_alias=AliasChoices(
            "ELEVENLABS_OUTPUT_FORMAT", "suno_lab_elevenlabs_output_format"
        ),
    )
    clap_enabled: bool = Field(default=False)
    clap_model_name: str = Field(default="laion/clap-htsat-unfused")
    use_fake_namer: bool = Field(
        default=False,
        validation_alias=AliasChoices("USE_FAKE_NAMER", "suno_lab_use_fake_namer"),
    )

    model_config = SettingsConfigDict(
        env_prefix="SUNO_LAB_",
        case_sensitive=False,
        populate_by_name=True,
        env_file=BASE_DIR / ".env",
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return (init_settings, env_settings, dotenv_settings, file_secret_settings)

    @model_validator(mode="before")
    @classmethod
    def _coerce_legacy_provider(cls, data):
        if not isinstance(data, dict):
            return data
        legacy = (
            data.get("music_provider")
            or data.get("MUSIC_PROVIDER")
            or data.get("suno_lab_music_provider")
        )
        if legacy in {"lyria", "hf"}:
            data["music_provider"] = "fake"
        return data

    @field_validator("music_provider")
    @classmethod
    def _validate_provider(cls, value: str) -> str:
        if value in {"lyria", "hf"}:
            return "fake"
        if value not in {"fake", "elevenlabs"}:
            raise ValueError("music_provider must be 'fake' or 'elevenlabs'")
        return value

    @computed_field
    @property
    def cors_allow_origins(self) -> list[str]:
        return _parse_origins(self.cors_allow_origins_raw)



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a singleton Settings instance for this process."""
    return Settings()
