from __future__ import annotations

import httpx
import pytest

from backend.app.services.openai_cluster_naming_provider import (
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


def test_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append(json)
        return make_response("Bright Pads\n")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    label = provider.name_cluster(["retro synths", "bright pads"])

    assert label == "Bright Pads"
    assert len(calls) == 1


def test_strips_punctuation_and_quotes(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        return make_response('"Dark-Pulse!"')

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    label = provider.name_cluster(["dark bass"])

    assert label == "Dark Pulse"


def test_truncates_prompts(monkeypatch: pytest.MonkeyPatch) -> None:
    recorded = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        recorded["json"] = json
        return make_response("Bright")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    long_prompt = "a" * 120
    provider.name_cluster([long_prompt, long_prompt + "b"])

    sent = recorded["json"]["messages"][1]["content"].split("\n")
    assert len(sent) == 2
    assert all(len(p) == 100 for p in sent)


def test_model_returns_empty_after_cleanup(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        return make_response("!!!")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    with pytest.raises(ValueError):
        provider.name_cluster(["anything"])


def test_openai_error_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        raise httpx.HTTPError("boom")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    with pytest.raises(httpx.HTTPError):
        provider.name_cluster(["fails"])


def test_more_than_three_prompts(monkeypatch: pytest.MonkeyPatch) -> None:
    recorded = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        recorded["json"] = json
        return make_response("Bright Synthwave")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    prompts = [f"prompt {i}" for i in range(5)]
    provider.name_cluster(prompts)

    sent_prompts = recorded["json"]["messages"][1]["content"].split("\n")
    assert len(sent_prompts) == 3
    assert sent_prompts == prompts[:3]


def test_non_ascii_removed(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url, headers=None, json=None, timeout=None):
        return make_response("Ciné Pads")

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = OpenAiClusterNamingProvider(api_key="token")

    label = provider.name_cluster(["cinematic pads"])

    assert label == "Cine Pads"
