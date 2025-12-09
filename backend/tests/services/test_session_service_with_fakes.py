from pathlib import Path
from uuid import UUID, uuid4

import numpy as np
import pytest

from suno_backend.app.models.domain import Batch, BriefParams, Session
from suno_backend.app.services.fake_cluster_naming_provider import FakeClusterNamingProvider
from suno_backend.app.services.fake_embedding_provider import FakeEmbeddingProvider
from suno_backend.app.services.fake_music_provider import FakeMusicProvider
from suno_backend.app.services.providers import ClusterNamingProvider, MusicProvider
from suno_backend.app.services.session_service import (
    GenerationFailedError,
    InvalidRequestError,
    NotFoundError,
    SessionService,
)
from suno_backend.app.services.session_store import SessionStore


BRIEF = "epic cinematic ambience"
PARAMS = BriefParams(energy=0.7, density=0.3, duration_sec=8.0)
EXPECTED_PROMPT = "epic cinematic ambience | energy=0.70 | density=0.30 | duration=8.0s"


class EmptyMusicProvider(MusicProvider):
    def generate_batch(self, prompt: str, num_clips: int, duration_sec: float):
        return []


class FailingNamer(ClusterNamingProvider):
    def name_cluster(self, prompts):
        raise RuntimeError("naming failed")


def make_service(
    tmp_path: Path,
    music_provider: MusicProvider | None = None,
    namer: ClusterNamingProvider | None = None,
    max_batch_size: int = 4,
    default_max_k: int = 3,
    min_similarity: float = 0.3,
) -> SessionService:
    store = SessionStore()
    music = music_provider or FakeMusicProvider(tmp_path)
    embedder = FakeEmbeddingProvider()
    naming = namer or FakeClusterNamingProvider()
    return SessionService(
        store=store,
        music=music,
        embedder=embedder,
        namer=naming,
        media_root=tmp_path,
        max_batch_size=max_batch_size,
        default_max_k=default_max_k,
        min_similarity=min_similarity,
    )


def test_create_initial_batch_success(tmp_path: Path) -> None:
    service = make_service(tmp_path)

    session = service.create_initial_batch(BRIEF, PARAMS, num_clips=3)

    assert isinstance(session, Session)
    assert len(session.batches) == 1
    batch = session.batches[0]
    assert isinstance(batch, Batch)
    assert batch.prompt_text == EXPECTED_PROMPT
    assert batch.num_requested == 3
    assert batch.num_generated == 3
    assert 1 <= len(batch.clusters) <= 3

    all_track_ids: set[UUID] = set()
    expected_label = FakeClusterNamingProvider().name_cluster([EXPECTED_PROMPT])
    for cluster in batch.clusters:
        assert cluster.label == expected_label
        all_track_ids.update(cluster.track_ids)

    assert len(all_track_ids) == batch.num_generated
    for track_id in all_track_ids:
        final_path = tmp_path / str(session.id) / f"{track_id}.wav"
        assert final_path.exists()


@pytest.mark.parametrize("num_clips", [0, 10])
def test_create_initial_batch_invalid_num_clips(tmp_path: Path, num_clips: int) -> None:
    service = make_service(tmp_path, max_batch_size=4)

    with pytest.raises(InvalidRequestError):
        service.create_initial_batch(BRIEF, PARAMS, num_clips=num_clips)


def test_create_initial_batch_generation_failure(tmp_path: Path) -> None:
    service = make_service(tmp_path, music_provider=EmptyMusicProvider())

    with pytest.raises(GenerationFailedError):
        service.create_initial_batch(BRIEF, PARAMS, num_clips=2)


def test_create_initial_batch_naming_fallback(tmp_path: Path) -> None:
    service = make_service(tmp_path, namer=FailingNamer())

    session = service.create_initial_batch(BRIEF, PARAMS, num_clips=1)

    batch = session.batches[0]
    assert len(batch.clusters) == 1
    assert batch.clusters[0].label == "cluster-1"


def test_more_like_cluster_success(tmp_path: Path) -> None:
    service = make_service(tmp_path)
    session = service.create_initial_batch(BRIEF, PARAMS, num_clips=3)
    parent_cluster = session.batches[0].clusters[0]

    new_batch = service.more_like_cluster(
        session_id=session.id, cluster_id=parent_cluster.id, num_clips=2
    )

    assert isinstance(new_batch, Batch)
    assert len(session.batches) == 2
    assert new_batch is session.batches[-1]
    assert len(new_batch.clusters) == 1
    child_cluster = new_batch.clusters[0]
    assert child_cluster.id != parent_cluster.id
    assert child_cluster.label == parent_cluster.label
    assert len(child_cluster.track_ids) == new_batch.num_generated
    assert 0 < new_batch.num_generated <= new_batch.num_requested

    for track_id in child_cluster.track_ids:
        final_path = tmp_path / str(session.id) / f"{track_id}.wav"
        assert final_path.exists()

    centroid = service.store.get_centroid(session.id, child_cluster.id)
    assert centroid is not None
    assert isinstance(centroid, np.ndarray)


def test_more_like_cluster_missing_session_or_cluster(tmp_path: Path) -> None:
    service = make_service(tmp_path)
    session = service.create_initial_batch(BRIEF, PARAMS, num_clips=1)
    missing_cluster_id = uuid4()

    with pytest.raises(NotFoundError):
        service.more_like_cluster(uuid4(), uuid4(), num_clips=1)

    with pytest.raises(NotFoundError):
        service.more_like_cluster(session.id, missing_cluster_id, num_clips=1)
