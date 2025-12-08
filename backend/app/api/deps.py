from __future__ import annotations

import os

from fastapi import Depends

from backend.app.services.clap_embedding_provider import ClapEmbeddingProvider
from backend.app.services.fake_cluster_naming_provider import FakeClusterNamingProvider
from backend.app.services.fake_embedding_provider import FakeEmbeddingProvider
from backend.app.services.fake_music_provider import FakeMusicProvider
from backend.app.services.openai_cluster_naming_provider import OpenAiClusterNamingProvider
from backend.app.services.providers import (
    ClusterNamingProvider,
    EmbeddingProvider,
    MusicProvider,
)
from backend.app.services.session_service import SessionService
from backend.app.services.session_store import SessionStore
from backend.app.settings import Settings, get_settings

_session_store: SessionStore | None = None
_music_provider: MusicProvider | None = None
_embedding_provider: EmbeddingProvider | None = None
_cluster_namer: ClusterNamingProvider | None = None
_session_service: SessionService | None = None


def get_session_store() -> SessionStore:
    global _session_store
    if _session_store is None:
        _session_store = SessionStore()
    return _session_store


def get_music_provider() -> MusicProvider:
    global _music_provider
    if _music_provider is None:
        settings = get_settings()
        _music_provider = FakeMusicProvider(settings.media_root)
    return _music_provider


def get_embedding_provider() -> EmbeddingProvider:
    global _embedding_provider
    if _embedding_provider is None:
        settings = get_settings()
        if settings.clap_enabled:
            _embedding_provider = ClapEmbeddingProvider(settings.clap_model_name)
        else:
            _embedding_provider = FakeEmbeddingProvider()
    return _embedding_provider


def get_cluster_namer() -> ClusterNamingProvider:
    global _cluster_namer
    if _cluster_namer is None:
        settings = get_settings()
        if settings.openai_api_key and not os.getenv("USE_FAKE_NAMER"):
            _cluster_namer = OpenAiClusterNamingProvider(settings.openai_api_key)
        else:
            _cluster_namer = FakeClusterNamingProvider()
    return _cluster_namer


def get_session_service(
    store: SessionStore = Depends(get_session_store),
    music: MusicProvider = Depends(get_music_provider),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    namer: ClusterNamingProvider = Depends(get_cluster_namer),
    settings: Settings = Depends(get_settings),
) -> SessionService:
    global _session_service
    if _session_service is None:
        if not isinstance(store, SessionStore):
            store = get_session_store()
        if not hasattr(music, "generate_batch"):
            music = get_music_provider()
        if not hasattr(embedder, "embed_audio"):
            embedder = get_embedding_provider()
        if not hasattr(namer, "name_cluster"):
            namer = get_cluster_namer()
        if not isinstance(settings, Settings):
            settings = get_settings()
        _session_service = SessionService(
            store=store,
            music=music,
            embedder=embedder,
            namer=namer,
            media_root=settings.media_root,
            max_batch_size=settings.max_batch_size,
            default_max_k=settings.default_max_k,
            min_similarity=settings.min_similarity,
        )
    return _session_service
