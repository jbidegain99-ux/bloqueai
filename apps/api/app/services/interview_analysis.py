"""
Interview analysis service using LLM for intelligent scoring and feedback.

Analyzes completed video interview transcripts to generate competency scores,
executive summaries, and hiring recommendations.
"""

import json
from typing import List, Dict, Optional

import structlog
from openai import OpenAI

from app.core.config import settings

logger = structlog.get_logger()


class InterviewAnalysisService:
    """
    Analyzes completed interviews to generate:
    1. Competency scores (1-10) with justifications
    2. Executive summary for recruiters
    3. Hiring recommendation with confidence level
    4. Strengths, areas for improvement, and red flags
    """

    SCORING_RUBRIC: Dict[str, Dict[str, object]] = {
        "communication": {
            "name": "Comunicación",
            "description": "Claridad, articulación, capacidad de explicar ideas complejas",
            "weight": 0.20,
        },
        "technical": {
            "name": "Competencia Técnica",
            "description": "Conocimiento del rol, habilidades específicas, experiencia relevante",
            "weight": 0.25,
        },
        "problem_solving": {
            "name": "Resolución de Problemas",
            "description": "Pensamiento estructurado, creatividad, análisis",
            "weight": 0.20,
        },
        "cultural_fit": {
            "name": "Ajuste Cultural",
            "description": "Valores, actitud, colaboración, motivación",
            "weight": 0.15,
        },
        "experience": {
            "name": "Experiencia Relevante",
            "description": "Background aplicable al puesto, logros demostrables",
            "weight": 0.20,
        },
    }

    def __init__(self) -> None:
        if not settings.llm_api_key:
            logger.warning("interview_analysis_no_api_key", msg="LLM API key not configured")
        self.client = OpenAI(
            api_key=settings.llm_api_key or "not-configured",
            base_url=settings.llm_base_url,
        )
        self.model = settings.llm_model

    async def analyze_interview(
        self,
        transcript: List[Dict[str, str]],
        job_title: str,
        job_description: str,
        job_requirements: List[str],
        candidate_name: str,
        candidate_cv_summary: Optional[str] = None,
    ) -> Dict[str, object]:
        """
        Perform comprehensive analysis of an interview.

        Returns complete analysis with scores, summary, and recommendation.
        """
        formatted_transcript = self._format_transcript(transcript)

        analysis_prompt = self._build_analysis_prompt(
            formatted_transcript,
            job_title,
            job_description,
            job_requirements,
            candidate_name,
            candidate_cv_summary,
        )

        logger.info(
            "interview_analysis_started",
            candidate=candidate_name,
            job=job_title,
            transcript_entries=len(transcript),
        )

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": analysis_prompt},
            ],
            temperature=0.3,
        )

        raw_text = response.choices[0].message.content or ""
        analysis = self._parse_analysis_response(raw_text)

        # Calculate overall score from competency scores
        analysis["overall_score"] = self._calculate_overall_score(
            analysis.get("scores", {})
        )
        analysis["transcript_length"] = len(transcript)
        analysis["model_used"] = self.model

        logger.info(
            "interview_analysis_completed",
            candidate=candidate_name,
            overall_score=analysis["overall_score"],
        )

        return analysis

    def _format_transcript(self, transcript: List[Dict[str, str]]) -> str:
        """Format transcript for LLM analysis."""
        lines = []
        for entry in transcript:
            speaker = "Entrevistador" if entry.get("speaker") == "ai" else "Candidato"
            timestamp = entry.get("timestamp", "")
            text = entry.get("text", "")
            lines.append(f"[{timestamp}] {speaker}: {text}")
        return "\n\n".join(lines)

    def _get_system_prompt(self) -> str:
        return (
            "Eres un experto en evaluación de talento y reclutamiento para empresas en Latinoamérica.\n"
            "Tu rol es analizar entrevistas de video y proporcionar evaluaciones objetivas, justas y accionables.\n\n"
            "Principios de evaluación:\n"
            "1. Sé objetivo y evita sesgos basados en género, edad, origen, o acentos\n"
            "2. Evalúa basándote únicamente en las respuestas y su relevancia al puesto\n"
            "3. Proporciona justificaciones específicas citando respuestas del candidato\n"
            "4. Sé constructivo en la retroalimentación\n"
            "5. Considera el contexto cultural latinoamericano\n\n"
            "Tu análisis debe ser profesional, detallado y útil para la toma de decisiones de contratación."
        )

    def _build_analysis_prompt(
        self,
        transcript: str,
        job_title: str,
        job_description: str,
        job_requirements: List[str],
        candidate_name: str,
        cv_summary: Optional[str],
    ) -> str:
        requirements_list = "\n".join(f"- {req}" for req in job_requirements) if job_requirements else "- No especificados"

        cv_context = ""
        if cv_summary:
            cv_context = f"\n## Contexto del CV del Candidato\n{cv_summary}\n"

        rubric_text = "\n".join(
            f"- **{v['name']}** ({k}): {v['description']} - Peso: {float(v['weight']) * 100:.0f}%"
            for k, v in self.SCORING_RUBRIC.items()
        )

        return f"""Analiza la siguiente entrevista de video y proporciona una evaluación completa.

## Puesto: {job_title}

## Descripción del Trabajo
{job_description}

## Requisitos Clave
{requirements_list}

## Candidato: {candidate_name}
{cv_context}

## Rúbrica de Evaluación
{rubric_text}

## Transcripción de la Entrevista
{transcript}

---

## Instrucciones de Análisis

Proporciona tu análisis en el siguiente formato JSON estructurado:

```json
{{
  "scores": {{
    "communication": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos de la entrevista>"
    }},
    "technical": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }},
    "problem_solving": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }},
    "cultural_fit": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }},
    "experience": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }}
  }},
  "strengths": [
    "<fortaleza específica 1>",
    "<fortaleza específica 2>",
    "<fortaleza específica 3>"
  ],
  "areas_for_improvement": [
    "<área de mejora 1>",
    "<área de mejora 2>"
  ],
  "red_flags": [
    "<señal de alerta si hay alguna, o array vacío>"
  ],
  "executive_summary": "<Resumen de 3-4 oraciones para el reclutador>",
  "recommendation": {{
    "decision": "<STRONGLY_RECOMMEND | RECOMMEND | NEUTRAL | NOT_RECOMMEND | STRONGLY_NOT_RECOMMEND>",
    "confidence": <0.0-1.0>,
    "rationale": "<1-2 oraciones explicando la recomendación>"
  }},
  "suggested_next_steps": [
    "<siguiente paso sugerido 1>",
    "<siguiente paso sugerido 2>"
  ],
  "interview_quality": {{
    "completeness": <1-10>,
    "depth_of_answers": <1-10>,
    "notes": "<observaciones sobre la calidad de la entrevista>"
  }}
}}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después."""

    def _parse_analysis_response(self, response_text: str) -> Dict[str, object]:
        """Parse LLM's JSON response."""
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError as e:
            logger.error(
                "interview_analysis_parse_error",
                error=str(e),
                response_preview=response_text[:200],
            )
            return {
                "error": f"Failed to parse analysis: {str(e)}",
                "raw_response": response_text[:500],
                "scores": {},
                "executive_summary": "Error al analizar la entrevista",
                "recommendation": {
                    "decision": "NEUTRAL",
                    "confidence": 0.0,
                    "rationale": "No se pudo completar el análisis automático",
                },
            }

    def _calculate_overall_score(self, scores: Dict[str, object]) -> float:
        """Calculate weighted overall score."""
        total = 0.0
        total_weight = 0.0

        for key, config in self.SCORING_RUBRIC.items():
            if key in scores and isinstance(scores[key], dict):
                score = scores[key].get("score", 0)
                weight = float(config["weight"])
                total += float(score) * weight
                total_weight += weight

        if total_weight == 0:
            return 0.0

        return round(total / total_weight, 1)


# Singleton instance
_analysis_service: Optional[InterviewAnalysisService] = None


def get_analysis_service() -> InterviewAnalysisService:
    """Get or create the singleton analysis service instance."""
    global _analysis_service
    if _analysis_service is None:
        _analysis_service = InterviewAnalysisService()
    return _analysis_service
