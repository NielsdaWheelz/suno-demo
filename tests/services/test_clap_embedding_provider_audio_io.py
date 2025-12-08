from pathlib import Path
import wave

import numpy as np

from backend.app.services.clap_embedding_provider import ClapEmbeddingProvider


def _write_pcm_wav(path: Path, sample_rate: int = 16000, stereo: bool = False) -> None:
    duration_sec = 0.02
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    samples = (0.6 * np.sin(2 * np.pi * 1000 * t) * 32767).astype(np.int16)
    if stereo:
        samples = np.stack([samples, samples], axis=1).flatten()

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2 if stereo else 1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())


def test_embed_audio_handles_pcm_wav_and_returns_vector(tmp_path: Path) -> None:
    wav_path = tmp_path / "sine.wav"
    _write_pcm_wav(wav_path, sample_rate=16000, stereo=True)

    provider = ClapEmbeddingProvider()
    embedding = provider.embed_audio(wav_path)

    assert embedding.dtype == np.float32
    assert embedding.ndim == 1
    assert embedding.shape[0] == provider._model_dim
    assert np.any(embedding != 0)


def test_embed_audio_rejects_unsupported_sample_width(tmp_path: Path) -> None:
    wav_path = tmp_path / "bad_width.wav"
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(1)  # 8-bit to trigger rejection
        wf.setframerate(16000)
        wf.writeframes(b"\x00" * 10)

    provider = ClapEmbeddingProvider()
    try:
        provider.embed_audio(wav_path)
    except ValueError as exc:
        assert "16-bit" in str(exc)
    else:
        raise AssertionError("Expected ValueError for unsupported sample width")
