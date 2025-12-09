from __future__ import annotations

import string
import unicodedata
from typing import List
import logging

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
        prepared_prompts = [prompt[:100] for prompt in prompts[:3]]
        prompt_body = "\n".join(prepared_prompts)  # newline joining to preserve separation
        logger.info(
            "openai namer request model=%s prompts=%s", self._model, prepared_prompts
        )

        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "system",
                    "content": "produce 1-3 word ASCII label, no punctuation, no quotes",
                },
                {"role": "user", "content": prompt_body},
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
        cleaned = cleaned.replace('"', "").replace("'", "")
        cleaned = cleaned.translate(str.maketrans({ch: " " for ch in string.punctuation}))
        cleaned = unicodedata.normalize("NFKD", cleaned)
        cleaned = cleaned.encode("ascii", "ignore").decode()
        cleaned = " ".join(cleaned.split())
        words = cleaned.split(" ") if cleaned else []
        cleaned = " ".join(words[:3]) if words else ""
        if not cleaned:
            raise ValueError("empty label after cleanup")

        logger.info(
            "openai namer response raw=%r cleaned=%s", content, cleaned
        )
        return cleaned
