from pathlib import Path
import wave

import numpy as np

from suno_backend.app.services.fake_cluster_naming_provider import FakeClusterNamingProvider
from suno_backend.app.services.fake_embedding_provider import FakeEmbeddingProvider
from suno_backend.app.services.fake_music_provider import FakeMusicProvider


def test_fake_music_provider_generates_wav_files(tmp_path: Path) -> None:
    provider = FakeMusicProvider(media_root=tmp_path)
    prompt = "make a beat"
    num_clips = 3
    duration = 1.5

    clips = provider.generate_batch(prompt=prompt, num_clips=num_clips, duration_sec=duration)

    assert len(clips) == num_clips
    tmp_dir = tmp_path / "tmp"
    for clip in clips:
        assert clip.audio_path.parent == tmp_dir
        assert clip.audio_path.suffix == ".wav"
        assert clip.audio_path.exists()
        assert clip.duration_sec == duration
        assert clip.raw_prompt == prompt
        with wave.open(str(clip.audio_path), "rb") as wf:
            assert wf.getnchannels() == 1
            assert wf.getsampwidth() == 2
            assert wf.getframerate() == 16000
            assert wf.getnframes() >= 1


def test_fake_embedding_provider_audio_embeddings_are_deterministic(tmp_path: Path) -> None:
    provider = FakeEmbeddingProvider()
    path_one = tmp_path / "one.wav"
    path_one.touch()
    path_two = tmp_path / "two.wav"
    path_two.touch()

    embedding_one_first = provider.embed_audio(path_one)
    embedding_one_second = provider.embed_audio(path_one)
    embedding_two = provider.embed_audio(path_two)

    assert embedding_one_first.shape == (8,)
    assert embedding_one_first.dtype == np.float32
    assert np.array_equal(embedding_one_first, embedding_one_second)
    assert not np.array_equal(embedding_one_first, embedding_two)


def test_fake_embedding_provider_text_embeddings_are_deterministic() -> None:
    provider = FakeEmbeddingProvider()

    embedding_first = provider.embed_text("abc")
    embedding_second = provider.embed_text("abc")

    assert embedding_first.shape == (8,)
    assert embedding_first.dtype == np.float32
    assert np.array_equal(embedding_first, embedding_second)


def test_fake_cluster_naming_provider_rules() -> None:
    provider = FakeClusterNamingProvider()
    prompts = ["calm piano", "soft strings"]

    label_first = provider.name_cluster(prompts)
    label_second = provider.name_cluster(prompts)

    assert label_first.isascii()
    assert 1 <= len(label_first.split()) <= 3
    for ch in '.,!?;:"\'':
        assert ch not in label_first
    assert label_first == label_second
