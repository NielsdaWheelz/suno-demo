import hashlib
from pathlib import Path

import numpy as np

from suno_backend.app.services.providers import EmbeddingProvider


class FakeEmbeddingProvider(EmbeddingProvider):
    def __init__(self) -> None:
        pass

    def embed_audio(self, audio_path: Path) -> np.ndarray:
        return self._vector_from_string(str(audio_path))

    def embed_text(self, text: str) -> np.ndarray:
        return self._vector_from_string(text)

    def _vector_from_string(self, value: str) -> np.ndarray:
        digest = hashlib.sha256(value.encode("utf-8")).digest()
        uints = np.frombuffer(digest, dtype=np.uint32)[:8]
        vector = uints.astype(np.float32) / np.iinfo(np.uint32).max
        return vector.astype(np.float32)
