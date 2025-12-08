from __future__ import annotations

from pathlib import Path
from typing import Tuple
import wave

import numpy as np
import torch
import torchaudio
from transformers import ClapModel, ClapProcessor

from backend.app.services.providers import EmbeddingProvider

_processor: ClapProcessor | None = None
_model: ClapModel | None = None
_model_dim: int | None = None

def _load_model_once(model_name: str = "laion/clap-htsat-unfused") -> Tuple[ClapProcessor, ClapModel, int]:
    global _processor, _model, _model_dim

    if _processor is not None and _model is not None and _model_dim is not None:
        return _processor, _model, _model_dim

    processor = ClapProcessor.from_pretrained(model_name)
    model = ClapModel.from_pretrained(model_name)
    model.eval()
    for param in model.parameters():
        param.requires_grad_(False)

    with torch.no_grad():
        dummy_audio = [np.zeros(48000, dtype=np.float32)]
        inputs = processor(audio=dummy_audio, return_tensors="pt", sampling_rate=48000)
        audio_embeds = model.get_audio_features(**inputs)
        dim = int(audio_embeds.shape[-1])

    _processor = processor
    _model = model
    _model_dim = dim
    return _processor, _model, _model_dim


class ClapEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model_name: str = "laion/clap-htsat-unfused") -> None:
        """Load or reuse the global CLAP model and processor."""
        self._processor, self._model, self._model_dim = _load_model_once(model_name)

    def embed_audio(self, audio_path: Path) -> np.ndarray:
        with wave.open(str(audio_path), "rb") as wf:
            sample_rate = wf.getframerate()
            num_channels = wf.getnchannels()
            num_frames = wf.getnframes()
            audio_bytes = wf.readframes(num_frames)

        waveform_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        if num_channels > 1:
            waveform_np = waveform_np.reshape(-1, num_channels).mean(axis=1)

        waveform = torch.from_numpy(waveform_np) / 32768.0
        waveform = waveform.unsqueeze(0)

        if sample_rate != 48000:
            resample = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=48000)
            waveform = resample(waveform)

        waveform = waveform.to(torch.float32)
        if waveform.dim() > 1:
            waveform = waveform.squeeze(0)

        max_val = waveform.abs().max()
        if max_val > 0:
            waveform = waveform / max_val

        audio_inputs = self._processor(
            audio=[waveform.numpy()],
            return_tensors="pt",
            sampling_rate=48000,
        )

        with torch.no_grad():
            audio_embeds = self._model.get_audio_features(**audio_inputs)

        embedding = audio_embeds.squeeze().to(torch.float32).cpu().numpy()
        return embedding

    def embed_text(self, text: str) -> np.ndarray:
        text_inputs = self._processor(
            text=[text],
            return_tensors="pt",
            padding=True,
        )

        with torch.no_grad():
            text_embeds = self._model.get_text_features(**text_inputs)

        embedding = text_embeds.squeeze().to(torch.float32).cpu().numpy()
        return embedding
