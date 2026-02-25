"""Tests for the embedding service."""

import pytest
from unittest.mock import patch, MagicMock

from app.services.embedding_service import EmbeddingService


@pytest.fixture
def svc():
    """Create a fresh EmbeddingService instance for each test."""
    return EmbeddingService()


@pytest.fixture
def mock_openai_response():
    """Mock OpenAI embeddings.create response."""
    return MagicMock(
        data=[MagicMock(embedding=[0.1] * 1536)],
        usage=MagicMock(total_tokens=100),
    )


class TestEmbeddingService:
    """Tests for EmbeddingService."""

    @pytest.mark.asyncio
    async def test_generate_embedding_returns_correct_dimensions(
        self, svc, mock_openai_response
    ):
        with patch.object(
            svc.client.embeddings,
            "create",
            return_value=mock_openai_response,
        ):
            result = await svc.generate_embedding("Test text")

            assert len(result.embedding) == 1536
            assert result.model == "text-embedding-3-small"
            assert result.dimensions == 1536
            assert result.tokens_used == 100

    @pytest.mark.asyncio
    async def test_generate_embedding_uses_cache(
        self, svc, mock_openai_response
    ):
        with patch.object(
            svc.client.embeddings,
            "create",
            return_value=mock_openai_response,
        ) as mock_create:
            # First call hits API
            await svc.generate_embedding("Same text")
            # Second call should use cache
            await svc.generate_embedding("Same text")

            assert mock_create.call_count == 1

    @pytest.mark.asyncio
    async def test_generate_embedding_cache_bypass(
        self, svc, mock_openai_response
    ):
        with patch.object(
            svc.client.embeddings,
            "create",
            return_value=mock_openai_response,
        ) as mock_create:
            await svc.generate_embedding("Same text", use_cache=False)
            await svc.generate_embedding("Same text", use_cache=False)

            assert mock_create.call_count == 2

    @pytest.mark.asyncio
    async def test_generate_embedding_empty_text_raises(self, svc):
        with pytest.raises(ValueError, match="cannot be empty"):
            await svc.generate_embedding("")

    @pytest.mark.asyncio
    async def test_generate_embedding_whitespace_only_raises(self, svc):
        with pytest.raises(ValueError, match="cannot be empty"):
            await svc.generate_embedding("   ")

    def test_cosine_similarity_identical_vectors(self, svc):
        vector = [0.1] * 1536
        similarity = svc.cosine_similarity(vector, vector)
        assert abs(similarity - 1.0) < 0.0001

    def test_cosine_similarity_orthogonal_vectors(self, svc):
        vector1 = [1.0] + [0.0] * 1535
        vector2 = [0.0, 1.0] + [0.0] * 1534
        similarity = svc.cosine_similarity(vector1, vector2)
        assert abs(similarity) < 0.0001

    def test_cosine_similarity_opposite_vectors(self, svc):
        vector1 = [1.0] + [0.0] * 1535
        vector2 = [-1.0] + [0.0] * 1535
        similarity = svc.cosine_similarity(vector1, vector2)
        assert abs(similarity + 1.0) < 0.0001

    def test_clear_cache(self, svc):
        svc._cache["test"] = "value"
        svc.clear_cache()
        assert len(svc._cache) == 0

    @pytest.mark.asyncio
    async def test_generate_embeddings_batch_empty(self, svc):
        results = await svc.generate_embeddings_batch([])
        assert results == []

    @pytest.mark.asyncio
    async def test_generate_embeddings_batch(self, svc):
        mock_response = MagicMock(
            data=[
                MagicMock(embedding=[0.1] * 1536),
                MagicMock(embedding=[0.2] * 1536),
            ],
            usage=MagicMock(total_tokens=200),
        )
        with patch.object(
            svc.client.embeddings,
            "create",
            return_value=mock_response,
        ):
            results = await svc.generate_embeddings_batch(["Text A", "Text B"])

            assert len(results) == 2
            assert len(results[0].embedding) == 1536
            assert len(results[1].embedding) == 1536

    def test_truncate_text(self, svc):
        long_text = "a" * 40000
        truncated = svc._truncate_text(long_text)
        assert len(truncated) == 30000
