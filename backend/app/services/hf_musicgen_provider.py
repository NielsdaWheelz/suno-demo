from __future__ import annotations

import wave
from pathlib import Path
from typing import List
from uuid import uuid4

import requests

from backend.app.services.providers import GeneratedClip, MusicProvider
from backend.app.services.session_service import GenerationFailedError


class HfMusicGenProvider(MusicProvider):
    def __init__(self, api_url: str, model_id: str, api_token: str, media_root: Path) -> None:
        self.api_url = api_url
        self.model_id = model_id
        self.api_token = api_token
        self.media_root = media_root

    def generate_batch(
        self, prompt: str, num_clips: int, duration_sec: float
    ) -> List[GeneratedClip]:
        tmp_dir = self.media_root / "tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)

        endpoint = f"{self.api_url}/{self.model_id}"
        headers = {"Authorization": f"Bearer {self.api_token}"}
        payload = {"inputs": prompt, "parameters": {"duration": duration_sec}}

        clips: List[GeneratedClip] = []

        for _ in range(num_clips):
            try:
                response = requests.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
            except requests.RequestException:
                continue

            audio_bytes = response.content
            if not audio_bytes:
                continue

            audio_path = tmp_dir / f"{uuid4().hex}.wav"
            try:
                with open(audio_path, "wb") as f:
                    f.write(audio_bytes)
            except OSError:
                continue

            try:
                with wave.open(str(audio_path), "rb") as wf:
                    frames = wf.getnframes()
                    sample_rate = wf.getframerate()
                    if sample_rate == 0:
                        raise ValueError("invalid sample rate")
                    duration = frames / float(sample_rate)
            except (wave.Error, OSError, ValueError):
                audio_path.unlink(missing_ok=True)
                continue

            if duration <= 0:
                audio_path.unlink(missing_ok=True)
                continue

            clips.append(
                GeneratedClip(
                    audio_path=audio_path,
                    duration_sec=duration,
                    raw_prompt=prompt,
                )
            )

        if not clips:
            raise GenerationFailedError(prompt)

        return clips
