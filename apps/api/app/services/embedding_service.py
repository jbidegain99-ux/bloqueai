"""OpenAI embedding service for generating vector embeddings."""

import hashlib
from typing import List

import numpy as np
import openai
import structlog
from pydantic import BaseModel

from app.core.config import settings

logger = structlog.get_logger()


class EmbeddingResult(BaseModel):
    """Result of an embedding generation."""

    text: str
    embedding: List[float]
    model: str
    dimensions: int
    tokens_used: int


class EmbeddingService:
    """Service for generating embeddings using OpenAI-compatible API.

    Model: text-embedding-3-small (default)
    Dimensions: 1536
    """

    MAX_CHARS = 30000

    def __init__(self) -> None:
        self.client = openai.OpenAI(
            api_key=settings.llm_api_key or "dummy",
            base_url=settings.llm_base_url,
        )
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions
        self._cache: dict[str, EmbeddingResult] = {}

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key from text hash."""
        return hashlib.md5(text.encode()).hexdigest()

    def _truncate_text(self, text: str) -> str:
        """Truncate text if too long."""
        if len(text) > self.MAX_CHARS:
            logger.warning(
                "text_truncated",
                original_length=len(text),
                max_chars=self.MAX_CHARS,
            )
            return text[: self.MAX_CHARS]
        return text

    async def generate_embedding(
        self,
        text: str,
        use_cache: bool = True,
    ) -> EmbeddingResult:
        """Generate embedding for a text string.

        Args:
            text: Text to convert to embedding.
            use_cache: Whether to use in-memory cache.

        Returns:
            EmbeddingResult with the vector and metadata.

        Raises:
            ValueError: If text is empty.
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        clean_text = self._truncate_text(text.strip())

        cache_key = self._get_cache_key(clean_text)
        if use_cache and cache_key in self._cache:
            logger.debug("embedding_cache_hit", key=cache_key[:8])
            return self._cache[cache_key]

        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=clean_text,
                dimensions=self.dimensions,
            )

            embedding = response.data[0].embedding
            tokens_used = response.usage.total_tokens

            result = EmbeddingResult(
                text=clean_text[:100] + "..." if len(clean_text) > 100 else clean_text,
                embedding=embedding,
                model=self.model,
                dimensions=len(embedding),
                tokens_used=tokens_used,
            )

            if use_cache:
                self._cache[cache_key] = result

            logger.info(
                "embedding_generated",
                dimensions=len(embedding),
                tokens=tokens_used,
            )
            return result

        except openai.APIError as e:
            logger.error("openai_api_error", error=str(e))
            raise
        except Exception as e:
            logger.error("embedding_generation_failed", error=str(e))
            raise

    async def generate_embeddings_batch(
        self,
        texts: List[str],
        use_cache: bool = True,
    ) -> List[EmbeddingResult]:
        """Generate embeddings for multiple texts in a single API call."""
        if not texts:
            return []

        clean_texts = [self._truncate_text(t.strip()) for t in texts if t and t.strip()]
        if not clean_texts:
            return []

        results: list[tuple[int, EmbeddingResult]] = []
        texts_to_embed: list[str] = []
        text_indices: list[int] = []

        for i, text in enumerate(clean_texts):
            cache_key = self._get_cache_key(text)
            if use_cache and cache_key in self._cache:
                results.append((i, self._cache[cache_key]))
            else:
                texts_to_embed.append(text)
                text_indices.append(i)

        if texts_to_embed:
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=texts_to_embed,
                    dimensions=self.dimensions,
                )

                for j, embedding_data in enumerate(response.data):
                    original_idx = text_indices[j]
                    text = texts_to_embed[j]

                    result = EmbeddingResult(
                        text=text[:100] + "..." if len(text) > 100 else text,
                        embedding=embedding_data.embedding,
                        model=self.model,
                        dimensions=len(embedding_data.embedding),
                        tokens_used=response.usage.total_tokens // len(texts_to_embed),
                    )

                    if use_cache:
                        cache_key = self._get_cache_key(text)
                        self._cache[cache_key] = result

                    results.append((original_idx, result))

            except Exception as e:
                logger.error("batch_embedding_failed", error=str(e))
                raise

        results.sort(key=lambda x: x[0])
        return [r[1] for r in results]

    def cosine_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float],
    ) -> float:
        """Calculate cosine similarity between two embeddings."""
        a = np.array(embedding1)
        b = np.array(embedding2)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def clear_cache(self) -> None:
        """Clear the in-memory embedding cache."""
        self._cache.clear()
        logger.info("embedding_cache_cleared")


# Singleton instance
embedding_service = EmbeddingService()
