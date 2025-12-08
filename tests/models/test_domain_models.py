from uuid import uuid4

import pytest
from pydantic import ValidationError

from backend.app.models.domain import Batch, BriefParams, ClusterSummary, Session, Track


def test_brief_params_minimal_valid():
    params = BriefParams(energy=0.5, density=0.5, duration_sec=10.0)
    assert params.energy == 0.5
    assert params.density == 0.5
    assert params.duration_sec == 10.0


def test_track_minimal_valid():
    track = Track(
        batch_id=uuid4(),
        cluster_id=uuid4(),
        audio_url="/media/session/track.wav",
        duration_sec=5.0,
        raw_prompt="prompt",
    )
    assert track.audio_url.endswith(".wav")
    assert track.duration_sec == 5.0
    assert track.raw_prompt == "prompt"


def test_cluster_summary_minimal_valid():
    summary = ClusterSummary(
        batch_id=uuid4(),
        label="label",
        track_ids=[uuid4(), uuid4()],
    )
    assert summary.label == "label"
    assert len(summary.track_ids) == 2


def test_batch_minimal_valid():
    cluster = ClusterSummary(
        batch_id=uuid4(),
        label="cluster",
        track_ids=[],
    )
    batch = Batch(
        session_id=uuid4(),
        prompt_text="p",
        num_requested=1,
        num_generated=0,
        clusters=[cluster],
    )
    assert batch.prompt_text == "p"
    assert batch.num_requested == 1
    assert batch.clusters == [cluster]


def test_session_minimal_valid():
    params = BriefParams(energy=0.4, density=0.6, duration_sec=8.0)
    batch = Batch(
        session_id=uuid4(),
        prompt_text="prompt",
        num_requested=2,
        num_generated=2,
        clusters=[],
    )
    session = Session(brief_text="brief", params=params, batches=[batch])
    assert session.brief_text == "brief"
    assert session.params == params
    assert session.batches == [batch]


@pytest.mark.parametrize(
    "params_kwargs",
    [
        {"energy": -0.1, "density": 0.5, "duration_sec": 5.0},
        {"energy": 1.1, "density": 0.5, "duration_sec": 5.0},
        {"energy": 0.5, "density": -0.1, "duration_sec": 5.0},
        {"energy": 0.5, "density": 1.1, "duration_sec": 5.0},
        {"energy": 0.5, "density": 0.5, "duration_sec": 0.0},
        {"energy": 0.5, "density": 0.5, "duration_sec": -1.0},
    ],
)
def test_brief_params_invalid(params_kwargs):
    with pytest.raises(ValidationError):
        BriefParams(**params_kwargs)


def test_track_duration_invalid():
    with pytest.raises(ValidationError):
        Track(
            batch_id=uuid4(),
            cluster_id=uuid4(),
            audio_url="/media/session/track.wav",
            duration_sec=0.0,
            raw_prompt="prompt",
        )


def test_track_raw_prompt_empty_invalid():
    with pytest.raises(ValidationError):
        Track(
            batch_id=uuid4(),
            cluster_id=uuid4(),
            audio_url="/media/session/track.wav",
            duration_sec=1.0,
            raw_prompt="",
        )


def test_session_brief_empty_invalid():
    params = BriefParams(energy=0.5, density=0.5, duration_sec=5.0)
    with pytest.raises(ValidationError):
        Session(brief_text="", params=params, batches=[])
