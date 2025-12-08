from dataclasses import dataclass
from pathlib import Path
from typing import List, Protocol

import numpy as np


@dataclass
class GeneratedClip:
    audio_path: Path
    duration_sec: float
    raw_prompt: str


class MusicProvider(Protocol):
    def generate_batch(self, prompt: str, num_clips: int, duration_sec: float) -> List[GeneratedClip]:
        ...


class EmbeddingProvider(Protocol):
    def embed_audio(self, audio_path: Path) -> np.ndarray:
        ...

    def embed_text(self, text: str) -> np.ndarray:
        ...


class ClusterNamingProvider(Protocol):
    def name_cluster(self, prompts: List[str]) -> str:
        ...
