from __future__ import annotations

import base64
import logging
import wave
from email.parser import BytesParser
from email.policy import default as default_policy
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

import requests

from backend.app.services.providers import GeneratedClip, MusicProvider
from backend.app.services.session_service import GenerationFailedError

logger = logging.getLogger(__name__)


class ElevenLabsMusicProvider(MusicProvider):
    def __init__(
        self,
        media_root: Path,
        api_key: str,
        output_format: str = "pcm_44100",
        timeout_seconds: float = 90.0,
    ) -> None:
        self.media_root = media_root
        self.output_format = output_format
        self.sample_rate = self._parse_pcm_sample_rate(output_format)
        self.channels = 1
        self.sample_width = 2  # bytes
        self.timeout_seconds = timeout_seconds
        self.tmp_dir = self.media_root / "tmp"
        self.tmp_dir.mkdir(parents=True, exist_ok=True)

        if not api_key:
            raise ValueError("elevenlabs_api_key is required for ElevenLabsMusicProvider")
        self.api_key = api_key

    def generate_batch(
        self, prompt: str, num_clips: int, duration_sec: float
    ) -> List[GeneratedClip]:
        clips: List[GeneratedClip] = []
        target_duration = duration_sec
        for idx in range(num_clips):
            try:
                clip = self._generate_single_clip(prompt, target_duration, idx)
            except Exception:
                logger.exception("ElevenLabs clip generation failed (index=%s)", idx)
                continue
            if clip:
                clips.append(clip)
            else:
                logger.warning("ElevenLabs clip generation returned None (index=%s)", idx)

        if not clips:
            raise GenerationFailedError("ElevenLabsMusicProvider: all generations failed")

        return clips

    def _generate_single_clip(
        self, prompt: str, target_duration: float, clip_index: int
    ) -> Optional[GeneratedClip]:
        url = "https://api.elevenlabs.io/v1/music/detailed"
        params = {"output_format": self.output_format}
        payload = {
            "prompt": prompt,
            "music_length_ms": int(target_duration * 1000),
            "model_id": "music_v1",
            "force_instrumental": True,
        }
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}

        logger.info(
            "ElevenLabs request clip=%s duration=%.2fs format=%s",
            clip_index,
            target_duration,
            self.output_format,
        )
        resp = requests.post(
            url, headers=headers, params=params, json=payload, timeout=self.timeout_seconds
        )
        if resp.status_code != 200:
            logger.error(
                "ElevenLabs HTTP error clip=%s status=%s body=%s",
                clip_index,
                resp.status_code,
                resp.text,
            )
            raise GenerationFailedError(f"ElevenLabs: status {resp.status_code}")

        audio_bytes = self._extract_audio_bytes(resp)
        if not audio_bytes:
            raise GenerationFailedError("ElevenLabs: no audio in response")

        frame_count = len(audio_bytes) // (self.sample_width * self.channels)
        if frame_count <= 0:
            raise GenerationFailedError("ElevenLabs: zero frames")

        duration = frame_count / float(self.sample_rate)
        audio_path = self.tmp_dir / f"{uuid4().hex}.wav"
        with wave.open(str(audio_path), "wb") as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(self.sample_width)
            wf.setframerate(self.sample_rate)
            wf.writeframes(audio_bytes)

        logger.info(
            "ElevenLabs clip %s wrote wav path=%s frames=%s duration=%.3fs",
            clip_index,
            audio_path,
            frame_count,
            duration,
        )
        return GeneratedClip(
            audio_path=audio_path,
            duration_sec=duration,
            raw_prompt=prompt,
        )

    def _extract_audio_bytes(self, resp: requests.Response) -> bytes | None:
        content_type = resp.headers.get("content-type", "")
        if "multipart" not in content_type:
            logger.error("ElevenLabs expected multipart, got %s", content_type)
            return None

        try:
            raw = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8") + resp.content
            message = BytesParser(policy=default_policy).parsebytes(raw)
        except Exception:
            logger.exception("ElevenLabs failed to parse multipart response")
            return None

        for part in message.iter_parts():
            ctype = part.get_content_type()
            if ctype.startswith("audio/") or ctype == "application/octet-stream":
                try:
                    payload = part.get_payload(decode=True)
                except Exception:
                    payload = None
                if payload:
                    if isinstance(payload, str):
                        try:
                            return base64.b64decode(payload)
                        except Exception:
                            logger.warning("ElevenLabs failed to b64decode audio payload")
                            continue
                    return payload
        logger.error("ElevenLabs multipart response missing audio part")
        return None

    @staticmethod
    def _parse_pcm_sample_rate(output_format: str) -> int:
        if not output_format.startswith("pcm_"):
            raise ValueError("ElevenLabs output_format must be a PCM option (e.g., pcm_44100)")
        try:
            return int(output_format.split("_", maxsplit=1)[1])
        except Exception as exc:
            raise ValueError(f"Invalid PCM output_format '{output_format}'") from exc
