from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    media_root: Path = Path("media")
    max_batch_size: int = 6
    default_max_k: int = 3
    min_similarity: float = 0.3
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
        env_file=".env",
        extra="ignore",
    )

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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a singleton Settings instance for this process."""
    return Settings()
