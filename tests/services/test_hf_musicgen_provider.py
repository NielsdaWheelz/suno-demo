from __future__ import annotations

import io
import math
import wave
from pathlib import Path
from typing import List

import pytest
import requests

from backend.app.services.hf_musicgen_provider import HfMusicGenProvider
from backend.app.services.session_service import GenerationFailedError


def make_wav_bytes(duration_sec: float, sample_rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    frame_count = max(1, int(duration_sec * sample_rate))
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * frame_count)
    return buffer.getvalue()


class DummyResponse:
    def __init__(self, content: bytes, status_code: int = 200) -> None:
        self.content = content
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")


def make_provider(tmp_path: Path) -> HfMusicGenProvider:
    return HfMusicGenProvider(
        api_url="https://fake-hf",
        model_id="musicgen-small",
        api_token="token",
        media_root=tmp_path,
    )


def test_successful_generation(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    wav_bytes = make_wav_bytes(duration_sec=0.1)
    call_urls: List[str] = []

    def fake_post(url, headers=None, json=None):
        call_urls.append(url)
        return DummyResponse(wav_bytes)

    monkeypatch.setattr(requests, "post", fake_post)
    provider = make_provider(tmp_path)

    clips = provider.generate_batch("calm piano", num_clips=3, duration_sec=1.0)

    assert len(call_urls) == 3
    assert len(clips) == 3

    tmp_dir = tmp_path / "tmp"
    files = list(tmp_dir.glob("*.wav"))
    assert len(files) == 3

    for clip in clips:
        assert clip.audio_path.exists()
        assert clip.audio_path.parent == tmp_dir
        assert clip.duration_sec > 0
        assert clip.raw_prompt == "calm piano"


def test_partial_failures(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    wav_bytes = make_wav_bytes(duration_sec=0.2)
    responses = [
        DummyResponse(wav_bytes),
        DummyResponse(b"", status_code=500),
    ]

    def fake_post(url, headers=None, json=None):
        resp = responses.pop(0)
        resp.raise_for_status()
        return resp

    monkeypatch.setattr(requests, "post", fake_post)
    provider = make_provider(tmp_path)

    clips = provider.generate_batch("lofi beat", num_clips=2, duration_sec=2.0)

    assert len(clips) == 1
    files = list((tmp_path / "tmp").glob("*.wav"))
    assert len(files) == 1


def test_total_failure(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    def fake_post(url, headers=None, json=None):
        raise requests.HTTPError("boom")

    monkeypatch.setattr(requests, "post", fake_post)
    provider = make_provider(tmp_path)

    with pytest.raises(GenerationFailedError):
        provider.generate_batch("fail me", num_clips=2, duration_sec=1.5)


def test_invalid_wav_bytes(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    valid_bytes = make_wav_bytes(duration_sec=0.3)
    responses = [
        DummyResponse(b"not a wav file"),
        DummyResponse(valid_bytes),
    ]

    def fake_post(url, headers=None, json=None):
        resp = responses.pop(0)
        resp.raise_for_status()
        return resp

    monkeypatch.setattr(requests, "post", fake_post)
    provider = make_provider(tmp_path)

    clips = provider.generate_batch("glitch", num_clips=2, duration_sec=1.0)

    assert len(clips) == 1
    files = list((tmp_path / "tmp").glob("*.wav"))
    assert len(files) == 1
    assert clips[0].audio_path in files


def test_duration_measured_correctly(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    target_duration = 0.25
    wav_bytes = make_wav_bytes(duration_sec=target_duration, sample_rate=8000)

    def fake_post(url, headers=None, json=None):
        return DummyResponse(wav_bytes)

    monkeypatch.setattr(requests, "post", fake_post)
    provider = make_provider(tmp_path)

    clips = provider.generate_batch("short tone", num_clips=1, duration_sec=1.0)

    assert len(clips) == 1
    measured = clips[0].duration_sec
    assert math.isclose(measured, target_duration, rel_tol=0.05, abs_tol=0.02)
