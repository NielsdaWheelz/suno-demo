from pathlib import Path
from typing import List
from uuid import uuid4
import wave

import numpy as np

from suno_backend.app.services.providers import GeneratedClip, MusicProvider


class FakeMusicProvider(MusicProvider):
    def __init__(self, media_root: Path) -> None:
        self.media_root = media_root

    def generate_batch(self, prompt: str, num_clips: int, duration_sec: float) -> List[GeneratedClip]:
        tmp_dir = self.media_root / "tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)

        sample_rate = 16000
        frame_count = max(1, int(duration_sec * sample_rate))
        silence = np.zeros(frame_count, dtype=np.int16)

        clips: List[GeneratedClip] = []
        for i in range(num_clips):
            filename = f"tmp_{i}_{uuid4().hex}.wav"
            audio_path = tmp_dir / filename
            with wave.open(str(audio_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(silence.tobytes())

            clips.append(
                GeneratedClip(
                    audio_path=audio_path,
                    duration_sec=duration_sec,
                    raw_prompt=prompt,
                )
            )

        return clips
