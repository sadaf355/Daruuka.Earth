"""GenAI layer.

The TRD calls for an `LLMProvider` abstraction so the vendor is swappable and the rest of
the application never imports a vendor SDK directly. Three concrete providers ship here:

* `GroundedFallbackProvider` — no network, no API key, answers purely from the structured
  context we assemble. This is the default so the product is fully demoable without paid
  credentials, and it is the reason `Ask Darukaa` can never hallucinate a site that does
  not exist.
* `GeminiProvider` / `GroqProvider` — real LLM calls, enabled by environment variable.
  Both are constrained by a system prompt that forbids answering outside the context.

Any provider failure degrades to the grounded fallback rather than surfacing a 500.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings

SYSTEM_PROMPT = (
    "You are Darukaa, an environmental intelligence copilot for a carbon and biodiversity "
    "monitoring platform. Answer ONLY from the supplied JSON context. If the answer is not "
    "present in the context, say so plainly instead of guessing. Be concise, factual, and "
    "quantitative. Never invent site names, metric values or dates."
)


class LLMProvider(ABC):
    """Vendor-agnostic completion interface."""

    name: str = "abstract"
    model: str = "unknown"

    @abstractmethod
    def complete(self, question: str, context: dict) -> str:
        """Return a natural-language answer grounded in `context`."""


class GroundedFallbackProvider(LLMProvider):
    """Template-based answering over the same structured context a real LLM would receive."""

    name = "grounded-fallback"
    model = "darukaa-context-v1"

    def complete(self, question: str, context: dict) -> str:
        site = context.get("site") or {}
        latest = context.get("latest") or {}
        status = context.get("status") or {}
        forecast = context.get("forecast") or {}
        project = context.get("project") or {}
        question_lower = question.lower()
        reasons = status.get("reasons") or []

        if not site and project:
            return (
                f"{project.get('name', 'This project')} contains "
                f"{project.get('site_count', 'several')} monitoring sites. Open a specific site "
                "to get grounded answers about its metrics, anomaly score and forecast."
            )

        if any(word in question_lower for word in ("risk", "anomal", "why", "wrong")):
            reason_text = " ".join(reasons) if reasons else "Recent metrics differ from the site's baseline."
            return (
                f"{site.get('name', 'This site')} is currently "
                f"{str(status.get('status', 'healthy')).replace('_', ' ')} with an anomaly score of "
                f"{float(status.get('anomaly_score', 0)):.2f}. {reason_text} The latest NDVI is "
                f"{latest.get('ndvi', '—')}, biodiversity is {latest.get('biodiversity_index', '—')}, "
                f"and carbon is {latest.get('carbon_tco2e', '—')} tCO₂e."
            )

        if "ndvi" in question_lower or "vegetation" in question_lower:
            confidence = round(float(forecast.get("confidence", 0.95)) * 100)
            return (
                f"The latest NDVI for {site.get('name', 'this site')} is {latest.get('ndvi', '—')}. "
                f"The forecast uses {forecast.get('model', 'the configured model')} with a "
                f"{confidence}% confidence interval, projecting {forecast.get('next_ndvi', '—')} "
                "for the next period."
            )

        if "carbon" in question_lower:
            return (
                f"Latest carbon is {latest.get('carbon_tco2e', '—')} tCO₂e for "
                f"{site.get('name', 'this site')}. The forecast endpoint projects the next six "
                "periods with a 95% confidence band."
            )

        if "biodiversity" in question_lower:
            return (
                f"Latest biodiversity index is {latest.get('biodiversity_index', '—')} for "
                f"{site.get('name', 'this site')}. Compare its recent change with NDVI and the "
                "anomaly score before deciding on field follow-up."
            )

        return (
            f"I grounded this answer in {site.get('name', 'the selected site')}'s latest "
            f"environmental metrics, health status and ML signals. Current status is "
            f"{str(status.get('status', 'healthy')).replace('_', ' ')}, with anomaly score "
            f"{float(status.get('anomaly_score', 0)):.2f}. Ask me about risk, NDVI, carbon, "
            "biodiversity, recent changes, or the forecast for a more specific analysis."
        )


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        self.model = settings.GEMINI_MODEL

    def complete(self, question: str, context: dict) -> str:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={settings.GEMINI_API_KEY}"
        )
        prompt = f"{SYSTEM_PROMPT}\n\nContext:\n{json.dumps(context, default=str)}\n\nQuestion: {question}"
        response = httpx.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=20)
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self) -> None:
        self.model = settings.GROQ_MODEL

    def complete(self, question: str, context: dict) -> str:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps({"context": context, "question": question}, default=str),
                    },
                ],
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def get_provider() -> LLMProvider:
    """Resolve the configured provider, falling back when credentials are absent."""
    provider = (settings.LLM_PROVIDER or "fallback").lower()
    if provider == "gemini" and settings.GEMINI_API_KEY:
        return GeminiProvider()
    if provider == "groq" and settings.GROQ_API_KEY:
        return GroqProvider()
    return GroundedFallbackProvider()


def ask(question: str, context: dict) -> tuple[str, str, str]:
    """Return (answer, provider_name, model_name)."""
    provider = get_provider()
    try:
        return provider.complete(question, context), provider.name, provider.model
    except Exception:
        fallback = GroundedFallbackProvider()
        return fallback.complete(question, context), fallback.name, fallback.model
