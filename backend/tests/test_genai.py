"""GenAI layer: the grounded fallback must never invent data."""

from app.core.config import settings
from app.services.genai import GroundedFallbackProvider, get_provider

CONTEXT = {
    "site": {"id": "abc", "name": "Amazon Site 04", "area_ha": 842.42},
    "latest": {"carbon_tco2e": 4821.0, "biodiversity_index": 72.4, "ndvi": 0.68},
    "status": {"status": "at_risk", "anomaly_score": 0.87, "reasons": ["NDVI has declined"]},
    "forecast": {"model": "Linear trend regression", "confidence": 0.95, "next_ndvi": 0.66},
}


def test_default_provider_needs_no_api_key(monkeypatch):
    """The product must be fully demoable without paid credentials."""
    monkeypatch.setattr(settings, "LLM_PROVIDER", "fallback")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    assert isinstance(get_provider(), GroundedFallbackProvider)


def test_risk_question_uses_the_supplied_status_and_reasons():
    answer = GroundedFallbackProvider().complete("Why is this site at risk?", CONTEXT)
    assert "Amazon Site 04" in answer
    assert "at risk" in answer
    assert "0.87" in answer
    assert "NDVI has declined" in answer


def test_metric_questions_quote_the_supplied_values():
    provider = GroundedFallbackProvider()
    assert "4821" in provider.complete("How is carbon doing?", CONTEXT)
    assert "72.4" in provider.complete("What about biodiversity?", CONTEXT)
    assert "0.68" in provider.complete("Show me the NDVI trend", CONTEXT)


def test_empty_context_does_not_fabricate_a_site():
    answer = GroundedFallbackProvider().complete("Which sites are failing?", {})
    assert "Amazon" not in answer
    assert "the selected site" in answer or "This site" in answer


def test_project_only_context_directs_the_user_to_a_site():
    answer = GroundedFallbackProvider().complete(
        "How is it going?", {"project": {"name": "Amazon Restoration", "site_count": 8}}
    )
    assert "Amazon Restoration" in answer
    assert "8" in answer
