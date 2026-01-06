"""Tests for LLM stub provider."""

import pytest
from app.services.llm import StubLLMProvider


class TestStubLLMProvider:
    """Test stub LLM provider determinism."""

    @pytest.fixture
    def provider(self):
        """Create stub provider."""
        return StubLLMProvider()

    @pytest.mark.asyncio
    async def test_deterministic_completion(self, provider):
        """Test that same input produces same output."""
        messages = [{"role": "user", "content": "Hello"}]

        result1 = await provider.complete(messages)
        result2 = await provider.complete(messages)

        assert result1 == result2

    @pytest.mark.asyncio
    async def test_cv_parsing_response(self, provider):
        """Test CV parsing stub response."""
        messages = [
            {"role": "system", "content": "Parse CV"},
            {"role": "user", "content": "CV text with skills Python JavaScript"},
        ]

        result = await provider.complete_json(messages)

        assert "name" in result
        assert "skills" in result
        assert isinstance(result["skills"], list)
        assert "experience" in result

    @pytest.mark.asyncio
    async def test_report_generation_response(self, provider):
        """Test report generation stub response."""
        messages = [
            {"role": "system", "content": "Generate report análisis"},
            {"role": "user", "content": "Interview transcript..."},
        ]

        result = await provider.complete_json(messages)

        assert "summary" in result
        assert "overall_score" in result
        assert "competency_scores" in result
        assert "strengths" in result
        assert "weaknesses" in result

        # Score should be within valid range
        assert 1 <= result["overall_score"] <= 5
        assert 0 <= result["confidence_score"] <= 100

    @pytest.mark.asyncio
    async def test_different_inputs_different_outputs(self, provider):
        """Test that different inputs produce different outputs."""
        messages1 = [{"role": "user", "content": "Input A"}]
        messages2 = [{"role": "user", "content": "Input B"}]

        result1 = await provider.complete(messages1)
        result2 = await provider.complete(messages2)

        # Results should be different for different inputs
        assert result1 != result2
