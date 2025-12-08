from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.api import deps
from backend.app.api.deps import get_session_service
from backend.app.main import app
from backend.app.models.domain import BriefParams
from backend.app.services.fake_cluster_naming_provider import FakeClusterNamingProvider
from backend.app.services.fake_embedding_provider import FakeEmbeddingProvider
from backend.app.services.fake_music_provider import FakeMusicProvider
from backend.app.services.providers import MusicProvider
from backend.app.services.session_service import SessionService
from backend.app.services.session_store import SessionStore
from backend.app.settings import get_settings


class EmptyMusicProvider(MusicProvider):
    def generate_batch(self, prompt: str, num_clips: int, duration_sec: float):
        return []


def make_service(
    media_root: Path,
    store: SessionStore | None = None,
    music_provider: MusicProvider | None = None,
) -> SessionService:
    settings = get_settings()
    return SessionService(
        store=store or SessionStore(),
        music=music_provider or FakeMusicProvider(media_root),
        embedder=FakeEmbeddingProvider(),
        namer=FakeClusterNamingProvider(),
        media_root=media_root,
        max_batch_size=settings.max_batch_size,
        default_max_k=settings.default_max_k,
        min_similarity=settings.min_similarity,
    )


@pytest.fixture
def client_with_service(tmp_path: Path):
    store = SessionStore()
    service = make_service(tmp_path, store=store)
    app.dependency_overrides[get_session_service] = lambda: service
    client = TestClient(app)
    try:
        yield client, service, store
    finally:
        app.dependency_overrides.clear()


def _create_session(client: TestClient, brief: str = "uplifting trance", num_clips: int = 2):
    params = {"energy": 0.7, "density": 0.5, "duration_sec": 12.0}
    response = client.post(
        "/sessions",
        json={"brief": brief, "num_clips": num_clips, "params": params},
    )
    return response


def test_create_session_success(client_with_service) -> None:
    client, _, _ = client_with_service

    response = _create_session(client, num_clips=3)

    assert response.status_code == 200
    data = response.json()
    session_id = UUID(data["session_id"])
    batch = data["batch"]
    UUID(batch["id"])
    clusters = batch["clusters"]
    assert isinstance(clusters, list) and len(clusters) > 0
    for cluster in clusters:
        UUID(cluster["id"])
        assert isinstance(cluster["label"], str) and cluster["label"]
        tracks = cluster["tracks"]
        assert isinstance(tracks, list) and len(tracks) > 0
        for track in tracks:
            UUID(track["id"])
            assert track["audio_url"].startswith(f"/media/{session_id}/")
            assert track["duration_sec"] > 0.0


def test_create_session_invalid_num_clips(client_with_service) -> None:
    client, _, _ = client_with_service
    settings = get_settings()

    response = _create_session(client, num_clips=settings.max_batch_size + 1)

    assert response.status_code == 400


def test_more_like_success(client_with_service) -> None:
    client, _, _ = client_with_service

    create_response = _create_session(client, num_clips=2)
    assert create_response.status_code == 200
    created = create_response.json()
    session_id = created["session_id"]
    first_cluster_id = created["batch"]["clusters"][0]["id"]

    response = client.post(
        f"/sessions/{session_id}/clusters/{first_cluster_id}/more",
        json={"num_clips": 2},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == session_id
    assert data["parent_cluster_id"] == first_cluster_id
    batch = data["batch"]
    UUID(batch["id"])
    clusters = batch["clusters"]
    assert isinstance(clusters, list) and len(clusters) == 1
    cluster = clusters[0]
    UUID(cluster["id"])
    assert isinstance(cluster["label"], str) and cluster["label"]
    tracks = cluster["tracks"]
    assert isinstance(tracks, list) and len(tracks) > 0
    for track in tracks:
        UUID(track["id"])
        assert track["audio_url"].startswith(f"/media/{session_id}/")
        assert track["duration_sec"] > 0.0


def test_more_like_missing_cluster(client_with_service) -> None:
    client, _, _ = client_with_service

    create_response = _create_session(client, num_clips=1)
    assert create_response.status_code == 200
    session_id = create_response.json()["session_id"]

    missing_cluster_id = uuid4()
    response = client.post(
        f"/sessions/{session_id}/clusters/{missing_cluster_id}/more",
        json={"num_clips": 1},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "cluster not found"}


def test_zero_generation_yields_500(tmp_path: Path) -> None:
    store = SessionStore()
    good_service = make_service(tmp_path, store=store)
    client = TestClient(app)

    try:
        app.dependency_overrides[get_session_service] = lambda: good_service
        initial_response = _create_session(client, num_clips=1)
        assert initial_response.status_code == 200
        initial_data = initial_response.json()
        session_id = initial_data["session_id"]
        cluster_id = initial_data["batch"]["clusters"][0]["id"]

        empty_service = make_service(tmp_path, store=store, music_provider=EmptyMusicProvider())
        app.dependency_overrides[get_session_service] = lambda: empty_service

        response_create = _create_session(client, num_clips=1)
        assert response_create.status_code == 500

        response_more = client.post(
            f"/sessions/{session_id}/clusters/{cluster_id}/more",
            json={"num_clips": 1},
        )
        assert response_more.status_code == 500
    finally:
        app.dependency_overrides.clear()


def test_dependency_singletons() -> None:
    store_one = deps.get_session_store()
    store_two = deps.get_session_store()
    assert store_one is store_two

    music_one = deps.get_music_provider()
    music_two = deps.get_music_provider()
    assert music_one is music_two

    embedder_one = deps.get_embedding_provider()
    embedder_two = deps.get_embedding_provider()
    assert embedder_one is embedder_two

    namer_one = deps.get_cluster_namer()
    namer_two = deps.get_cluster_namer()
    assert namer_one is namer_two

    service_one = deps.get_session_service()
    service_two = deps.get_session_service()
    assert service_one is service_two
