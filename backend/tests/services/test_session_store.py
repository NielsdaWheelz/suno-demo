from uuid import UUID, uuid4

import numpy as np
import pytest

from suno_backend.app.models.domain import Batch, BriefParams, ClusterSummary, Session
from suno_backend.app.services.session_store import SessionStore


def make_brief_params() -> BriefParams:
    return BriefParams(energy=0.5, density=0.5, duration_sec=10.0)


def make_cluster(cluster_id: UUID, batch_id: UUID, label: str) -> ClusterSummary:
    return ClusterSummary(id=cluster_id, batch_id=batch_id, label=label, track_ids=[])


def test_create_session_stores_and_returns_session():
    store = SessionStore()
    params = make_brief_params()

    session = store.create_session("test brief", params)

    assert isinstance(session, Session)
    assert session.id is not None
    assert session.brief_text == "test brief"
    assert session.params == params
    assert session.batches == []
    fetched = store.get_session(session.id)
    assert fetched is session


def test_get_session_missing_returns_none():
    store = SessionStore()

    result = store.get_session(uuid4())

    assert result is None


def test_add_batch_attaches_to_existing_session_and_stores_centroids():
    store = SessionStore()
    params = make_brief_params()
    session = store.create_session("brief", params)
    batch_id = uuid4()
    cluster_id_1 = uuid4()
    cluster_id_2 = uuid4()
    cluster1 = make_cluster(cluster_id_1, batch_id, "c1")
    cluster2 = make_cluster(cluster_id_2, batch_id, "c2")
    batch = Batch(
        id=batch_id,
        session_id=session.id,
        prompt_text="prompt",
        num_requested=2,
        num_generated=2,
        clusters=[cluster1, cluster2],
    )
    centroids = {
        cluster_id_1: np.array([1.0, 0.0], dtype=np.float32),
        cluster_id_2: np.array([0.5, 0.5], dtype=np.float32),
    }

    store.add_batch(session.id, batch, centroids)

    stored_session = store.get_session(session.id)
    assert stored_session is not None
    assert len(stored_session.batches) == 1
    assert stored_session.batches[0] is batch
    assert store.get_cluster(session.id, cluster_id_1) == cluster1
    assert store.get_cluster(session.id, cluster_id_2) == cluster2
    assert np.array_equal(store.get_centroid(session.id, cluster_id_1), centroids[cluster_id_1])
    assert np.array_equal(store.get_centroid(session.id, cluster_id_2), centroids[cluster_id_2])


def test_add_batch_raises_for_missing_session():
    store = SessionStore()
    session_id = uuid4()
    batch_id = uuid4()
    cluster_id = uuid4()
    batch = Batch(
        id=batch_id,
        session_id=session_id,
        prompt_text="prompt",
        num_requested=1,
        num_generated=1,
        clusters=[make_cluster(cluster_id, batch_id, "c")],
    )
    centroids = {cluster_id: np.array([1.0], dtype=np.float32)}

    with pytest.raises(ValueError, match="session"):
        store.add_batch(session_id, batch, centroids)


def test_add_batch_raises_for_mismatched_batch_session_id():
    store = SessionStore()
    params = make_brief_params()
    session = store.create_session("brief", params)
    batch_id = uuid4()
    cluster_id = uuid4()
    mismatched_session_id = uuid4()
    batch = Batch(
        id=batch_id,
        session_id=mismatched_session_id,
        prompt_text="prompt",
        num_requested=1,
        num_generated=1,
        clusters=[make_cluster(cluster_id, batch_id, "c")],
    )
    centroids = {cluster_id: np.array([1.0], dtype=np.float32)}

    with pytest.raises(ValueError, match="mismatch"):
        store.add_batch(session.id, batch, centroids)


def test_add_batch_raises_when_centroids_missing_or_extra():
    store = SessionStore()
    session = store.create_session("brief", make_brief_params())
    batch_id = uuid4()
    cluster_id_1 = uuid4()
    cluster_id_2 = uuid4()
    cluster1 = make_cluster(cluster_id_1, batch_id, "c1")
    cluster2 = make_cluster(cluster_id_2, batch_id, "c2")
    batch = Batch(
        id=batch_id,
        session_id=session.id,
        prompt_text="prompt",
        num_requested=2,
        num_generated=2,
        clusters=[cluster1, cluster2],
    )

    missing_centroid = {cluster_id_1: np.array([1.0], dtype=np.float32)}
    with pytest.raises(ValueError, match="missing"):
        store.add_batch(session.id, batch, missing_centroid)

    extra_centroid = {
        cluster_id_1: np.array([1.0], dtype=np.float32),
        cluster_id_2: np.array([2.0], dtype=np.float32),
        uuid4(): np.array([3.0], dtype=np.float32),
    }
    with pytest.raises(ValueError, match="extra"):
        store.add_batch(session.id, batch, extra_centroid)


def test_get_cluster_and_get_centroid_return_none_for_missing():
    store = SessionStore()
    session = store.create_session("brief", make_brief_params())
    batch_id = uuid4()
    cluster_id = uuid4()
    cluster = make_cluster(cluster_id, batch_id, "c")
    batch = Batch(
        id=batch_id,
        session_id=session.id,
        prompt_text="prompt",
        num_requested=1,
        num_generated=1,
        clusters=[cluster],
    )
    centroids = {cluster_id: np.array([1.0], dtype=np.float32)}
    store.add_batch(session.id, batch, centroids)

    assert store.get_cluster(uuid4(), cluster_id) is None
    assert store.get_cluster(session.id, uuid4()) is None
    assert store.get_centroid(uuid4(), cluster_id) is None
    assert store.get_centroid(session.id, uuid4()) is None
