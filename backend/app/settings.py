from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    media_root: Path = Path("media")
    max_batch_size: int = 6
    default_max_k: int = 3
    min_similarity: float = 0.3
    hf_api_url: str | None = None
    hf_model_id: str = "facebook/musicgen-small"
    hf_api_token: str | None = None
    openai_api_key: str | None = None
    clap_enabled: bool = Field(default=False)
    clap_model_name: str = Field(default="laion/clap-htsat-unfused")

    model_config = SettingsConfigDict(
        env_prefix="SUNO_LAB_",
        case_sensitive=False,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a singleton Settings instance for this process."""
    return Settings()
