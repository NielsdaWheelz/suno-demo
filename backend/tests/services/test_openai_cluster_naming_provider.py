from __future__ import annotations

import httpx
import pytest

from suno_backend.app.services.openai_cluster_naming_provider import (
    OpenAiClusterNamingProvider,
)


class DummyResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self.payload = payload
        self.status_code = status_code

    def json(self) -> dict:
        return self.payload


def make_response(content: str) -> DummyResponse:
    return DummyResponse({"choices": [{"message": {"content": content}}]})


def test_prompt_construction_emphasizes_variety(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    recorded = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        recorded["json"] = json
        return make_response("Neon Mirage")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    provider.name_cluster(["dark synthwave chase"])

    messages = recorded["json"]["messages"]
    system_content = messages[0]["content"]
    user_content = messages[1]["content"]

    assert "vivid" in system_content.lower()
    assert "not generic" in system_content.lower()
    assert "2-3 words" in user_content
    assert "ascii" in user_content.lower()


def test_post_process_strips_quotes_and_punctuation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        return make_response(' "Dark Neon Freeway.  "')

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    label = provider.name_cluster(["dark bass"])

    assert label == "Dark Neon Freeway"


def test_truncates_to_three_words(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        return make_response("one two three four five")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    label = provider.name_cluster(["anything"])

    assert label == "one two three"


def test_rejects_empty_after_cleanup(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        return make_response("!!!")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    with pytest.raises(ValueError):
        provider.name_cluster(["anything"])
