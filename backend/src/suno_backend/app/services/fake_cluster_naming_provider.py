import hashlib
from typing import List

from suno_backend.app.services.providers import ClusterNamingProvider


class FakeClusterNamingProvider(ClusterNamingProvider):
    def __init__(self) -> None:
        self._words = [
            "cluster",
            "alpha",
            "beta",
            "gamma",
            "delta",
            "echo",
            "forest",
            "ocean",
            "stone",
            "light",
        ]

    def name_cluster(self, prompts: List[str]) -> str:
        combined = "|".join(prompts)
        digest = hashlib.sha256(combined.encode("utf-8")).digest()

        word_count = (digest[0] % 3) + 1
        words: List[str] = []
        for idx in range(word_count):
            word_index = digest[idx + 1] % len(self._words)
            words.append(self._words[word_index])

        return " ".join(words)
