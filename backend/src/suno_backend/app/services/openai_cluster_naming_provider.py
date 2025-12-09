from __future__ import annotations

import string
import unicodedata
import logging
from typing import List

import httpx

from suno_backend.app.services.providers import ClusterNamingProvider

logger = logging.getLogger(__name__)


class OpenAiClusterNamingProvider(ClusterNamingProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._api_url = "https://api.openai.com/v1/chat/completions"
        self._model = "gpt-4o-mini"
        self._timeout = 10.0

    def name_cluster(self, prompts: List[str]) -> str:
        """
        Return 1-3 word ASCII label; raise on API errors or invalid model output.
        """
        prepared_prompts = [prompt[:200] for prompt in prompts[:3]]
        numbered_prompts = [
            f'{idx + 1}. "{prompt}"' for idx, prompt in enumerate(prepared_prompts)
        ]
        user_message = "\n".join(
            [
                "Here are some example prompts for songs in this cluster:",
                *numbered_prompts,
                "",
                "Rules:",
                "- Return only 1 label.",
                "- 2-3 words.",
                "- ASCII characters only.",
                "- No quotes. No punctuation. No commas or periods.",
                "- The label should be vivid and specific, not generic.",
                "- If you use a genre word, combine it with concrete imagery or mood.",
                "Now respond with just the label.",
            ]
        )
        logger.info(
            "openai namer request model=%s prompts=%s", self._model, prepared_prompts
        )

        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a naming assistant for clusters of AI-generated songs. "
                        "Given several short prompts, you invent one short, vivid label that helps users tell clusters apart. "
                        "Keep names distinct and not generic."
                    ),
                },
                {"role": "user", "content": user_message},
            ],
        }

        response = httpx.post(
            self._api_url,
            headers={"Authorization": f"Bearer {self._api_key}"},
            json=payload,
            timeout=self._timeout,
        )

        if response.status_code >= 400:
            raise ValueError(f"openai api error status {response.status_code}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise ValueError("malformed openai response")

        cleaned = content.strip()
        cleaned = cleaned.strip('"').strip("'")
        cleaned = unicodedata.normalize("NFKD", cleaned)
        cleaned = cleaned.encode("ascii", "ignore").decode()
        cleaned = cleaned.translate(str.maketrans({ch: " " for ch in string.punctuation}))
        cleaned = cleaned.rstrip(".,;:!?")
        cleaned = " ".join(cleaned.split())
        words = cleaned.split(" ") if cleaned else []
        if len(words) > 3:
            words = words[:3]
            cleaned = " ".join(words)
        if not cleaned or not words:
            raise ValueError("empty label after cleanup")

        logger.info(
            "openai namer response raw=%r cleaned=%s", content, cleaned
        )
        return cleaned
