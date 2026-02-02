"""Job Copilot AI service for generating job posting suggestions."""

import json
from typing import Optional, Dict, Any, List
from uuid import uuid4
from datetime import datetime

import structlog
from openai import OpenAI

from app.core.config import settings
from app.models.llm_log import LLMLog

logger = structlog.get_logger()


class JobCopilotService:
    """AI-powered job posting assistant."""

    def __init__(self, db_session=None, user_id=None):
        self.db = db_session
        self.user_id = user_id
        self.client = None
        self._init_client()

    def _init_client(self):
        """Initialize OpenAI client."""
        api_key = settings.llm_api_key
        if api_key and api_key.strip():
            self.client = OpenAI(api_key=api_key)

    def _log_llm_call(self, model: str, tokens_in: int, tokens_out: int,
                      latency_ms: int, status: str, operation: str,
                      error_message: str = None):
        """Log LLM API call."""
        if not self.db:
            return

        try:
            llm_log = LLMLog(
                id=uuid4(),
                user_id=self.user_id,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                total_tokens=tokens_in + tokens_out,
                latency_ms=latency_ms,
                status=status,
                error_message=error_message,
                endpoint="job_copilot",
                operation=operation,
                created_at=datetime.utcnow(),
            )
            self.db.add(llm_log)
            self.db.commit()
        except Exception as e:
            logger.warning("llm_log_failed", error=str(e))

    async def suggest_description(
        self,
        title: str,
        category: str,
        seniority: str,
        company_context: Optional[str] = None,
        partial_description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a job description suggestion.

        Args:
            title: Job title
            category: Job category (e.g., TECHNOLOGY, HEALTHCARE)
            seniority: Seniority level (e.g., JUNIOR, SENIOR)
            company_context: Optional company description for context
            partial_description: Optional existing description to improve

        Returns:
            Dict with 'description' and 'suggestions' keys
        """
        if not self.client:
            return {"error": "Servicio IA no disponible. Configura la API key de LLM en ajustes del sistema."}

        system_prompt = """Eres un experto en redaccion de ofertas de empleo.
Tu tarea es crear descripciones de trabajo atractivas, claras y profesionales.

Reglas:
1. Escribe en espanol neutro
2. Usa un tono profesional pero cercano
3. Destaca la propuesta de valor del puesto
4. Incluye 3-4 parrafos: intro, responsabilidades clave, cultura/beneficios
5. No incluyas requisitos (esos se agregan aparte)
6. Si hay descripcion parcial, mejorala manteniendo la esencia

Responde en JSON: {"description": "texto completo", "suggestions": ["tip1", "tip2"]}"""

        user_prompt = f"""Genera una descripcion de trabajo para:
Puesto: {title}
Categoria: {category}
Nivel: {seniority}
{f'Contexto empresa: {company_context}' if company_context else ''}
{f'Descripcion actual a mejorar: {partial_description}' if partial_description else ''}"""

        try:
            start_time = datetime.utcnow()

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )

            end_time = datetime.utcnow()
            latency_ms = int((end_time - start_time).total_seconds() * 1000)

            result = json.loads(response.choices[0].message.content)

            self._log_llm_call(
                model="gpt-4o-mini",
                tokens_in=response.usage.prompt_tokens if response.usage else 0,
                tokens_out=response.usage.completion_tokens if response.usage else 0,
                latency_ms=latency_ms,
                status="success",
                operation="suggest_description"
            )

            logger.info("job_copilot_description_generated", title=title)
            return result

        except Exception as e:
            logger.error("job_copilot_description_error", error=str(e))
            self._log_llm_call(
                model="gpt-4o-mini",
                tokens_in=0, tokens_out=0,
                latency_ms=0,
                status="error",
                operation="suggest_description",
                error_message=str(e)[:500]
            )
            return {"error": str(e)}

    async def suggest_requirements(
        self,
        title: str,
        category: str,
        seniority: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate job requirements suggestions (must_haves and nice_to_haves).

        Returns:
            Dict with 'must_haves' and 'nice_to_haves' lists
        """
        if not self.client:
            return {"error": "Servicio IA no disponible. Configura la API key de LLM en ajustes del sistema."}

        system_prompt = """Eres un experto en reclutamiento.
Tu tarea es generar requisitos realistas y relevantes para ofertas de empleo.

Reglas:
1. must_haves: 4-6 requisitos realmente esenciales
2. nice_to_haves: 3-5 habilidades deseables (no obligatorias)
3. Se especifico (no "experiencia relevante", sino "3+ anos en desarrollo backend")
4. Adapta al nivel de senioridad
5. Incluye habilidades tecnicas Y blandas relevantes

Responde en JSON:
{
  "must_haves": ["requisito1", "requisito2"],
  "nice_to_haves": ["deseable1", "deseable2"],
  "reasoning": "breve explicacion de la seleccion"
}"""

        user_prompt = f"""Genera requisitos para:
Puesto: {title}
Categoria: {category}
Nivel: {seniority}
{f'Descripcion: {description[:500]}' if description else ''}"""

        try:
            start_time = datetime.utcnow()

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.5,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )

            end_time = datetime.utcnow()
            latency_ms = int((end_time - start_time).total_seconds() * 1000)

            result = json.loads(response.choices[0].message.content)

            self._log_llm_call(
                model="gpt-4o-mini",
                tokens_in=response.usage.prompt_tokens if response.usage else 0,
                tokens_out=response.usage.completion_tokens if response.usage else 0,
                latency_ms=latency_ms,
                status="success",
                operation="suggest_requirements"
            )

            logger.info("job_copilot_requirements_generated", title=title)
            return result

        except Exception as e:
            logger.error("job_copilot_requirements_error", error=str(e))
            self._log_llm_call(
                model="gpt-4o-mini",
                tokens_in=0, tokens_out=0,
                latency_ms=0,
                status="error",
                operation="suggest_requirements",
                error_message=str(e)[:500]
            )
            return {"error": str(e)}

    async def suggest_interview_questions(
        self,
        title: str,
        category: str,
        seniority: str,
        must_haves: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate custom interview questions for the job.

        Returns:
            Dict with 'questions' list and 'categories' breakdown
        """
        if not self.client:
            return {"error": "Servicio IA no disponible. Configura la API key de LLM en ajustes del sistema."}

        system_prompt = """Eres un experto en entrevistas y evaluacion de talento.
Tu tarea es generar preguntas de entrevista efectivas para evaluar candidatos.

Reglas:
1. Genera 5-7 preguntas
2. Mezcla preguntas tecnicas, conductuales y situacionales
3. Adapta la complejidad al nivel de senioridad
4. Incluye al menos 1 pregunta sobre los must_haves clave
5. Preguntas abiertas que inviten reflexion

Responde en JSON:
{
  "questions": [
    {"question": "texto", "type": "technical|behavioral|situational", "evaluates": "competencia"}
  ],
  "notes": "consejos para el entrevistador"
}"""

        requirements_context = ""
        if must_haves:
            requirements_context = f"\nRequisitos clave a evaluar: {', '.join(must_haves[:5])}"

        user_prompt = f"""Genera preguntas de entrevista para:
Puesto: {title}
Categoria: {category}
Nivel: {seniority}{requirements_context}
{f'Descripcion: {description[:300]}' if description else ''}"""

        try:
            start_time = datetime.utcnow()

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.6,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )

            end_time = datetime.utcnow()
            latency_ms = int((end_time - start_time).total_seconds() * 1000)

            result = json.loads(response.choices[0].message.content)

            self._log_llm_call(
                model="gpt-4o-mini",
                tokens_in=response.usage.prompt_tokens if response.usage else 0,
                tokens_out=response.usage.completion_tokens if response.usage else 0,
                latency_ms=latency_ms,
                status="success",
                operation="suggest_questions"
            )

            logger.info("job_copilot_questions_generated", title=title, count=len(result.get("questions", [])))
            return result

        except Exception as e:
            logger.error("job_copilot_questions_error", error=str(e))
            self._log_llm_call(
                model="gpt-4o-mini",
                tokens_in=0, tokens_out=0,
                latency_ms=0,
                status="error",
                operation="suggest_questions",
                error_message=str(e)[:500]
            )
            return {"error": str(e)}


# Category-specific field templates for generic job form
JOB_CATEGORY_FIELDS = {
    "HEALTHCARE": {
        "fields": [
            {"key": "medical_license", "label": "Cedula Profesional", "type": "text", "required": True},
            {"key": "specialties", "label": "Especialidades", "type": "tags"},
            {"key": "certifications", "label": "Certificaciones", "type": "tags"},
            {"key": "hospital_experience", "label": "Experiencia hospitalaria", "type": "boolean"},
        ]
    },
    "DENTAL": {
        "fields": [
            {"key": "dental_license", "label": "Cedula de Odontologo", "type": "text", "required": True},
            {"key": "specialties", "label": "Especialidades (ortodoncia, endodoncia, etc.)", "type": "tags"},
            {"key": "equipment_experience", "label": "Equipos que maneja", "type": "tags"},
        ]
    },
    "FINANCE": {
        "fields": [
            {"key": "cpa_license", "label": "Cedula CPA/Contador", "type": "text"},
            {"key": "certifications", "label": "Certificaciones (CFA, FRM, etc.)", "type": "tags"},
            {"key": "software_experience", "label": "Software (SAP, Oracle, etc.)", "type": "tags"},
            {"key": "regulatory_knowledge", "label": "Conocimiento regulatorio", "type": "tags"},
        ]
    },
    "LEGAL": {
        "fields": [
            {"key": "bar_admission", "label": "Cedula de Abogado", "type": "text", "required": True},
            {"key": "practice_areas", "label": "Areas de practica", "type": "tags"},
            {"key": "languages_required", "label": "Idiomas requeridos", "type": "tags"},
            {"key": "litigation_experience", "label": "Experiencia en litigio", "type": "boolean"},
        ]
    },
    "TECHNOLOGY": {
        "fields": [
            {"key": "programming_languages", "label": "Lenguajes de programacion", "type": "tags"},
            {"key": "frameworks", "label": "Frameworks", "type": "tags"},
            {"key": "cloud_platforms", "label": "Plataformas cloud (AWS, GCP, Azure)", "type": "tags"},
            {"key": "methodologies", "label": "Metodologias (Agile, Scrum, etc.)", "type": "tags"},
        ]
    },
    "MANUFACTURING": {
        "fields": [
            {"key": "certifications", "label": "Certificaciones (Six Sigma, Lean, etc.)", "type": "tags"},
            {"key": "equipment_experience", "label": "Equipos/Maquinaria", "type": "tags"},
            {"key": "safety_certifications", "label": "Certificaciones de seguridad", "type": "tags"},
            {"key": "shift_availability", "label": "Disponibilidad de turnos", "type": "select", "options": ["Matutino", "Vespertino", "Nocturno", "Rotativo"]},
        ]
    },
    "SALES": {
        "fields": [
            {"key": "industries_experience", "label": "Industrias de experiencia", "type": "tags"},
            {"key": "quota_achieved", "label": "Quota alcanzada historicamente (%)", "type": "number"},
            {"key": "crm_experience", "label": "CRMs (Salesforce, HubSpot, etc.)", "type": "tags"},
            {"key": "territory", "label": "Territorio de venta", "type": "text"},
        ]
    },
    "HUMAN_RESOURCES": {
        "fields": [
            {"key": "certifications", "label": "Certificaciones (SHRM, PHR, etc.)", "type": "tags"},
            {"key": "hris_experience", "label": "HRIS (Workday, SAP HR, etc.)", "type": "tags"},
            {"key": "specializations", "label": "Especializaciones (compensaciones, desarrollo, etc.)", "type": "tags"},
        ]
    },
}


def get_category_fields(category: str) -> Dict[str, Any]:
    """Get category-specific fields template."""
    return JOB_CATEGORY_FIELDS.get(category.upper(), {"fields": []})
