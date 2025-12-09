from pathlib import Path
import wave

import numpy as np
import pytest

from suno_backend.app.core.clustering import cluster_embeddings
from suno_backend.app.core.similarity import filter_by_similarity
from suno_backend.app.services import clap_embedding_provider as clap_module
from suno_backend.app.services.clap_embedding_provider import ClapEmbeddingProvider


def _write_test_wav(path: Path, sample_rate: int = 16000, stereo: bool = False) -> None:
    duration_sec = 0.01
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    samples = (0.5 * np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)

    if stereo:
        samples = np.stack([samples, samples], axis=1).flatten()

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2 if stereo else 1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())


def test_model_is_singleton() -> None:
    provider_one = ClapEmbeddingProvider()
    provider_two = ClapEmbeddingProvider()

    assert clap_module._model is not None
    assert clap_module._processor is not None
    assert provider_one._model is clap_module._model
    assert provider_two._model is clap_module._model
    assert provider_one._processor is clap_module._processor
    assert provider_two._processor is clap_module._processor
    assert clap_module._model_dim is not None


def test_embed_audio_returns_expected_shape_and_dtype(tmp_path: Path) -> None:
    wav_path = tmp_path / "tone.wav"
    _write_test_wav(wav_path, sample_rate=16000, stereo=True)

    provider = ClapEmbeddingProvider()
    embedding = provider.embed_audio(wav_path)

    assert isinstance(embedding, np.ndarray)
    assert embedding.dtype == np.float32
    assert embedding.ndim == 1
    assert embedding.shape[0] == clap_module._model_dim
    assert embedding.shape[0] > 0


def test_embed_text_matches_audio_dimension(tmp_path: Path) -> None:
    wav_path = tmp_path / "text_dim.wav"
    _write_test_wav(wav_path, sample_rate=44100, stereo=False)

    provider = ClapEmbeddingProvider()
    audio_embedding = provider.embed_audio(wav_path)
    text_embedding = provider.embed_text("bright synthwave pads")

    assert text_embedding.shape == audio_embedding.shape
    assert text_embedding.dtype == np.float32


def test_embeddings_are_deterministic(tmp_path: Path) -> None:
    wav_path = tmp_path / "deterministic.wav"
    _write_test_wav(wav_path, sample_rate=22050, stereo=True)

    provider = ClapEmbeddingProvider()
    first = provider.embed_audio(wav_path)
    second = provider.embed_audio(wav_path)

    assert np.allclose(first, second, atol=1e-6)


def test_embed_audio_errors_on_missing_or_corrupted_file(tmp_path: Path) -> None:
    provider = ClapEmbeddingProvider()

    missing_path = tmp_path / "missing.wav"
    with pytest.raises(FileNotFoundError):
        provider.embed_audio(missing_path)

    corrupted_path = tmp_path / "corrupted.wav"
    corrupted_path.write_bytes(b"not a wav")
    with pytest.raises(Exception):
        provider.embed_audio(corrupted_path)


def test_embeddings_work_with_clustering_and_similarity(tmp_path: Path) -> None:
    wav_path = tmp_path / "cluster.wav"
    _write_test_wav(wav_path, sample_rate=16000, stereo=False)

    provider = ClapEmbeddingProvider()
    audio_embedding = provider.embed_audio(wav_path)
    text_embedding = provider.embed_text("bright synthwave pads")

    embeddings = [audio_embedding, text_embedding]
    clusters = cluster_embeddings(embeddings, max_k=3)
    centroid = np.mean(embeddings, axis=0)
    indices = filter_by_similarity(embeddings, centroid, min_similarity=0.0, max_results=2)

    assert sum(len(cluster) for cluster in clusters) == len(embeddings)
    assert set(indices).issubset({0, 1})
