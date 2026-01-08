"""LLM service with OpenAI-compatible API and stub fallback."""

import hashlib
import json
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx

from app.core.config import settings


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate completion from messages."""
        pass

    @abstractmethod
    async def complete_json(
        self,
        messages: list[dict[str, str]],
        schema: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Generate JSON completion from messages."""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI-compatible API provider."""

    def __init__(self):
        self.base_url = settings.llm_base_url.rstrip("/")
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate completion from messages."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def complete_json(
        self,
        messages: list[dict[str, str]],
        schema: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Generate JSON completion from messages."""
        # Add JSON instruction to system message
        json_instruction = "\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown or explanation."
        if messages and messages[0]["role"] == "system":
            messages = messages.copy()
            messages[0] = {
                "role": "system",
                "content": messages[0]["content"] + json_instruction,
            }
        else:
            messages = [{"role": "system", "content": json_instruction}] + messages

        response = await self.complete(messages, temperature=0.3, max_tokens=4000)

        # Parse JSON from response
        try:
            # Remove markdown code blocks if present
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re

            json_match = re.search(r"\{[\s\S]*\}", response)
            if json_match:
                return json.loads(json_match.group())
            raise


class StubLLMProvider(LLMProvider):
    """Deterministic stub provider for testing without API key."""

    def _generate_hash(self, content: str) -> str:
        """Generate a consistent hash from content."""
        return hashlib.md5(content.encode()).hexdigest()[:8]

    def _deterministic_score(self, text: str, min_val: float = 2.5, max_val: float = 4.5) -> float:
        """Generate a deterministic score based on text hash."""
        hash_val = int(self._generate_hash(text), 16)
        normalized = (hash_val % 100) / 100
        return round(min_val + normalized * (max_val - min_val), 1)

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate deterministic completion."""
        # Combine all messages for hash
        content = " ".join(m.get("content", "") for m in messages)
        hash_id = self._generate_hash(content)

        # Return a generic interview response
        return f"""Gracias por tu respuesta. Me parece interesante lo que mencionas.

Ahora, me gustaría profundizar un poco más. ¿Podrías contarme sobre un proyecto específico donde hayas demostrado estas habilidades?

[Response ID: {hash_id}]"""

    async def complete_json(
        self,
        messages: list[dict[str, str]],
        schema: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Generate deterministic JSON completion."""
        content = " ".join(m.get("content", "") for m in messages)
        hash_id = self._generate_hash(content)

        # Detect the type of request based on content
        lower_content = content.lower()

        if "cv" in lower_content or "resume" in lower_content or "curriculum" in lower_content:
            # CV parsing response
            return {
                "name": f"Candidato {hash_id.upper()}",
                "email": f"candidato.{hash_id}@email.com",
                "phone": "+1234567890",
                "location": "Ciudad de México, México",
                "headline": "Profesional en Tecnología",
                "summary": "Profesional con experiencia en desarrollo de software y gestión de proyectos.",
                "skills": [
                    "Python",
                    "JavaScript",
                    "SQL",
                    "Git",
                    "Agile",
                    "Comunicación",
                ],
                "experience": [
                    {
                        "title": "Desarrollador Senior",
                        "company": "Tech Company",
                        "start_date": "2020-01",
                        "end_date": "presente",
                        "description": "Desarrollo de aplicaciones web y APIs.",
                    },
                    {
                        "title": "Desarrollador",
                        "company": "Startup Inc",
                        "start_date": "2018-06",
                        "end_date": "2019-12",
                        "description": "Desarrollo full-stack con React y Node.js.",
                    },
                ],
                "education": [
                    {
                        "degree": "Ingeniería en Sistemas",
                        "institution": "Universidad Nacional",
                        "year": "2018",
                    }
                ],
                "languages": [
                    {"language": "Español", "level": "Nativo"},
                    {"language": "Inglés", "level": "Avanzado"},
                ],
            }

        elif "report" in lower_content or "análisis" in lower_content or "evalua" in lower_content:
            # Candidate report response
            base_score = self._deterministic_score(content, 3.0, 4.5)
            return {
                "summary": f"Candidato con perfil sólido y experiencia relevante. Demuestra buenas habilidades técnicas y de comunicación. [ID: {hash_id}]",
                "overall_score": base_score,
                "confidence_score": int(self._deterministic_score(content, 70, 95)),
                "competency_scores": {
                    "technical_skills": {
                        "score": self._deterministic_score(content + "tech", 3.0, 4.8),
                        "notes": "Buen dominio de tecnologías relevantes.",
                    },
                    "communication": {
                        "score": self._deterministic_score(content + "comm", 3.2, 4.5),
                        "notes": "Se expresa con claridad y profesionalismo.",
                    },
                    "problem_solving": {
                        "score": self._deterministic_score(content + "prob", 2.8, 4.6),
                        "notes": "Demuestra capacidad analítica.",
                    },
                    "teamwork": {
                        "score": self._deterministic_score(content + "team", 3.0, 4.4),
                        "notes": "Experiencia trabajando en equipo.",
                    },
                    "leadership": {
                        "score": self._deterministic_score(content + "lead", 2.5, 4.2),
                        "notes": "Potencial de liderazgo identificado.",
                    },
                    "adaptability": {
                        "score": self._deterministic_score(content + "adapt", 3.0, 4.3),
                        "notes": "Buena capacidad de adaptación a nuevos entornos.",
                    },
                    "cultural_fit": {
                        "score": self._deterministic_score(content + "culture", 3.2, 4.4),
                        "notes": "Buen ajuste con valores organizacionales.",
                    },
                },
                "skills_detected": ["Python", "JavaScript", "SQL", "Git", "Agile"],
                "skills_missing": [],
                "strengths": [
                    "Experiencia técnica sólida",
                    "Buena capacidad de comunicación",
                    "Actitud proactiva",
                ],
                "weaknesses": [
                    "Podría profundizar en arquitectura de sistemas",
                ],
                "risks": [
                    "Sin riesgos significativos identificados",
                ],
                "recommendations": [
                    "Adecuado para roles de desarrollo mid-senior",
                    "Considerar para proyectos técnicos desafiantes",
                ],
                "flags": [],
            }

        elif "pregunta" in lower_content or "question" in lower_content or "interview" in lower_content:
            # Interview question response
            return {
                "question": "Cuéntame sobre un desafío técnico que hayas enfrentado recientemente y cómo lo resolviste.",
                "question_id": f"q_{hash_id}",
                "category": "problem_solving",
            }

        else:
            # Generic response
            return {
                "response": f"Respuesta procesada correctamente. [ID: {hash_id}]",
                "status": "success",
            }


def get_llm_provider() -> LLMProvider:
    """Get the appropriate LLM provider based on configuration."""
    if settings.use_stub_llm:
        return StubLLMProvider()
    return OpenAIProvider()


# Singleton instance
llm_provider = get_llm_provider()
