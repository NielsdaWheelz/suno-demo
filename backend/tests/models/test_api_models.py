from uuid import uuid4

import pytest
from pydantic import ValidationError

from suno_backend.app.models.api import (
    BatchOut,
    ClusterOut,
    CreateSessionRequest,
    CreateSessionResponse,
    MoreLikeRequest,
    MoreLikeResponse,
    TrackOut,
)
from suno_backend.app.models.domain import BriefParams


def test_create_session_request_invalid_num_clips_below_range():
    params = BriefParams(energy=0.5, density=0.5, duration_sec=5.0)
    with pytest.raises(ValidationError):
        CreateSessionRequest(brief="brief", num_clips=0, params=params)


def test_create_session_request_invalid_num_clips_above_range():
    params = BriefParams(energy=0.5, density=0.5, duration_sec=5.0)
    with pytest.raises(ValidationError):
        CreateSessionRequest(brief="brief", num_clips=7, params=params)


def test_create_session_request_invalid_brief_empty():
    params = BriefParams(energy=0.5, density=0.5, duration_sec=5.0)
    with pytest.raises(ValidationError):
        CreateSessionRequest(brief="", num_clips=2, params=params)


@pytest.mark.parametrize("num_clips", [0, 7])
def test_more_like_request_invalid_num_clips(num_clips):
    with pytest.raises(ValidationError):
        MoreLikeRequest(num_clips=num_clips)


def test_round_trip_models():
    track = TrackOut(
        id=uuid4(),
        audio_url="/media/session/track.wav",
        duration_sec=4.0,
    )
    cluster = ClusterOut(id=uuid4(), label="label", tracks=[track])
    batch = BatchOut(id=uuid4(), clusters=[cluster])
    create_resp = CreateSessionResponse(session_id=uuid4(), batch=batch)

    dumped = create_resp.model_dump()
    recreated = CreateSessionResponse(**dumped)

    assert recreated.model_dump() == create_resp.model_dump()

    more_like = MoreLikeResponse(
        session_id=uuid4(),
        parent_cluster_id=uuid4(),
        batch=batch,
    )
    dumped_more = more_like.model_dump()
    recreated_more = MoreLikeResponse(**dumped_more)

    assert recreated_more.model_dump() == more_like.model_dump()
