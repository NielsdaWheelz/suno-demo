from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from suno_backend.app.services.elevenlabs_music_provider import ElevenLabsMusicProvider
from suno_backend.app.services.session_service import GenerationFailedError


class _FakeResponse:
    def __init__(self, status_code: int, headers: dict[str, str], content: bytes) -> None:
        self.status_code = status_code
        self.headers = headers
        self.content = content

    @property
    def text(self) -> str:
        try:
            return self.content.decode("utf-8")
        except Exception:
            return "<binary>"


def _fake_multipart(audio_bytes: bytes) -> tuple[dict[str, str], bytes]:
    boundary = "boundary123"
    headers = {"content-type": f"multipart/mixed; boundary={boundary}"}
    body = (
        b"--"
        + boundary.encode()
        + b"\r\nContent-Type: audio/wav\r\n\r\n"
        + audio_bytes
        + b"\r\n--"
        + boundary.encode()
        + b"--\r\n"
    )
    return headers, body


def test_generate_batch_writes_wav(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    audio_bytes = b"\x00\x01\x02\x03\x04\x05"
    headers, body = _fake_multipart(audio_bytes)

    def fake_post(*args: Any, **kwargs: Any) -> _FakeResponse:
        return _FakeResponse(status_code=200, headers=headers, content=body)

    monkeypatch.setattr("suno_backend.app.services.elevenlabs_music_provider.requests.post", fake_post)

    provider = ElevenLabsMusicProvider(
        media_root=tmp_path,
        api_key="test",
        output_format="pcm_44100",
    )

    clips = provider.generate_batch("prompt", num_clips=1, duration_sec=1.0)

    assert len(clips) == 1
    clip = clips[0]
    assert clip.audio_path.exists()
    assert clip.duration_sec > 0


def test_generate_batch_raises_on_http_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(*args: Any, **kwargs: Any) -> _FakeResponse:
        return _FakeResponse(status_code=500, headers={}, content=b"err")

    monkeypatch.setattr("suno_backend.app.services.elevenlabs_music_provider.requests.post", fake_post)

    provider = ElevenLabsMusicProvider(media_root=tmp_path, api_key="test")

    with pytest.raises(GenerationFailedError):
        provider.generate_batch("prompt", num_clips=1, duration_sec=1.0)
