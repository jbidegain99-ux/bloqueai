"""Interview Orchestrator - Dynamic AI-powered interview flow."""

import json
from typing import Any, Optional
from uuid import UUID

import structlog

from app.services.llm import llm_provider, LLMContext

logger = structlog.get_logger()


# Interview phases and their focus areas
INTERVIEW_PHASES = [
    {
        "phase": "introduction",
        "min_questions": 1,
        "max_questions": 1,
        "focus": "warm_welcome_and_motivation",
        "description": "Bienvenida cordial y pregunta sobre motivacion para el puesto",
    },
    {
        "phase": "experience",
        "min_questions": 2,
        "max_questions": 3,
        "focus": "relevant_experience",
        "description": "Experiencia profesional relevante para el puesto",
    },
    {
        "phase": "technical",
        "min_questions": 2,
        "max_questions": 4,
        "focus": "technical_skills",
        "description": "Habilidades tecnicas requeridas para el puesto",
    },
    {
        "phase": "behavioral",
        "min_questions": 2,
        "max_questions": 3,
        "focus": "soft_skills_and_behavior",
        "description": "Competencias blandas y comportamiento situacional",
    },
    {
        "phase": "culture",
        "min_questions": 1,
        "max_questions": 2,
        "focus": "cultural_fit",
        "description": "Ajuste cultural y valores",
    },
    {
        "phase": "closing",
        "min_questions": 1,
        "max_questions": 1,
        "focus": "closing_and_questions",
        "description": "Cierre y oportunidad para preguntas del candidato",
    },
]


class InterviewOrchestrator:
    """Orchestrates dynamic AI-powered interviews."""

    def __init__(
        self,
        job_info: Optional[dict[str, Any]] = None,
        candidate_info: Optional[dict[str, Any]] = None,
        rubric_info: Optional[dict[str, Any]] = None,
        language: str = "es",
    ):
        self.job_info = job_info or {}
        self.candidate_info = candidate_info or {}
        self.rubric_info = rubric_info or {}
        self.language = language

    def _build_system_prompt(self) -> str:
        """Build the system prompt for the interview AI."""
        lang_instruction = (
            "Responde SIEMPRE en espanol."
            if self.language == "es"
            else "Respond ALWAYS in English."
        )

        job_context = ""
        if self.job_info:
            job_context = f"""
## Puesto a Evaluar
- Titulo: {self.job_info.get('title', 'No especificado')}
- Descripcion: {self.job_info.get('description', 'No disponible')[:500]}
- Requisitos obligatorios: {', '.join(self.job_info.get('must_haves', []))}
- Requisitos deseables: {', '.join(self.job_info.get('nice_to_haves', []))}
- Nivel de senioridad: {self.job_info.get('seniority', 'No especificado')}
- Responsabilidades: {', '.join(self.job_info.get('responsibilities', [])[:3])}
"""

        candidate_context = ""
        if self.candidate_info:
            skills = self.candidate_info.get('skills', [])
            experience = self.candidate_info.get('experience', [])
            candidate_context = f"""
## Informacion del Candidato
- Skills conocidos: {', '.join(skills[:10]) if skills else 'No disponible'}
- Experiencia reciente: {experience[0].get('title', '') if experience else 'No disponible'} en {experience[0].get('company', '') if experience else ''}
- Resumen: {self.candidate_info.get('summary', 'No disponible')[:300]}
"""

        rubric_context = ""
        if self.rubric_info and self.rubric_info.get('criteria'):
            criteria_list = [
                f"- {c.get('name', '')}: {c.get('description', '')}"
                for c in self.rubric_info.get('criteria', [])[:5]
            ]
            rubric_context = f"""
## Criterios de Evaluacion (Rubrica)
{chr(10).join(criteria_list)}
"""

        return f"""Eres un entrevistador experto de TalentOS, una plataforma de reclutamiento con IA.
Tu objetivo es realizar una entrevista profesional, calida y conversacional para evaluar al candidato.

{lang_instruction}

{job_context}
{candidate_context}
{rubric_context}

## Instrucciones de Comportamiento
1. Se profesional pero cercano. Usa un tono calido y humano.
2. Haz UNA sola pregunta por turno. Mantén las preguntas cortas y claras.
3. Escucha activamente y haz follow-ups cuando la respuesta sea vaga o incompleta.
4. Adapta las preguntas al contexto del puesto y experiencia del candidato.
5. No hagas preguntas sobre: edad, estado civil, religion, orientacion sexual, salud, planes familiares.
6. Si detectas inconsistencias, indaga con tacto sin ser confrontacional.
7. Muestra interes genuino en las respuestas del candidato.

## Formato de Respuesta
SIEMPRE responde en JSON valido con esta estructura:
{{
    "message": "Tu mensaje/pregunta al candidato (texto natural, conversacional)",
    "internal_notes": {{
        "evaluation": {{
            "competencies_observed": ["competencia1", "competencia2"],
            "evidence": "evidencia textual de la respuesta",
            "score_estimate": 3.5,
            "flags": []
        }},
        "next_action": "continue|follow_up|change_topic|conclude",
        "reasoning": "por que tomas esta decision"
    }}
}}
"""

    async def generate_first_question(self) -> dict[str, Any]:
        """Generate the initial interview question."""
        LLMContext.set(operation="interview_first_question")

        system_prompt = self._build_system_prompt()

        user_prompt = """Es el inicio de la entrevista. Da la bienvenida al candidato de forma calida y profesional.
Preguntale sobre su motivacion para aplicar a este puesto especifico.

Recuerda: responde SOLO en JSON valido."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            result = await llm_provider.complete_json(messages)
            return {
                "message": result.get("message", self._get_fallback_greeting()),
                "phase": "introduction",
                "question_number": 1,
                "internal_notes": result.get("internal_notes", {}),
            }
        except Exception as e:
            logger.error("interview_first_question_failed", error=str(e))
            return {
                "message": self._get_fallback_greeting(),
                "phase": "introduction",
                "question_number": 1,
                "internal_notes": {"error": str(e)},
            }

    async def generate_next_question(
        self,
        conversation_history: list[dict[str, str]],
        current_phase: str,
        question_number: int,
        total_questions: int,
    ) -> dict[str, Any]:
        """Generate the next interview question based on conversation context."""
        LLMContext.set(operation="interview_next_question")

        system_prompt = self._build_system_prompt()

        # Build conversation context
        conv_text = "\n".join([
            f"{'Entrevistador' if m['role'] == 'assistant' else 'Candidato'}: {m['content']}"
            for m in conversation_history[-10:]  # Last 10 messages for context
        ])

        # Determine next phase if needed
        phase_info = next(
            (p for p in INTERVIEW_PHASES if p["phase"] == current_phase),
            INTERVIEW_PHASES[0]
        )

        progress_pct = (question_number / total_questions) * 100

        user_prompt = f"""## Conversacion hasta ahora:
{conv_text}

## Estado actual:
- Fase actual: {current_phase} ({phase_info['description']})
- Pregunta numero: {question_number} de {total_questions}
- Progreso: {progress_pct:.0f}%

## Tu tarea:
Analiza la ultima respuesta del candidato y decide:
1. Si la respuesta fue completa o necesita follow-up
2. Si es momento de cambiar de tema/fase
3. Genera la siguiente pregunta apropiada

Si estamos cerca del final ({progress_pct}% > 80%), prepara para cerrar la entrevista.

Recuerda: responde SOLO en JSON valido."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            result = await llm_provider.complete_json(messages)

            # Determine next phase based on AI recommendation
            next_action = result.get("internal_notes", {}).get("next_action", "continue")
            next_phase = current_phase

            if next_action == "change_topic":
                # Move to next phase
                phase_idx = next(
                    (i for i, p in enumerate(INTERVIEW_PHASES) if p["phase"] == current_phase),
                    0
                )
                if phase_idx < len(INTERVIEW_PHASES) - 1:
                    next_phase = INTERVIEW_PHASES[phase_idx + 1]["phase"]
            elif next_action == "conclude":
                next_phase = "closing"

            return {
                "message": result.get("message", self._get_fallback_question(current_phase)),
                "phase": next_phase,
                "question_number": question_number + 1,
                "internal_notes": result.get("internal_notes", {}),
                "should_end": next_action == "conclude" or question_number >= total_questions,
            }
        except Exception as e:
            logger.error("interview_next_question_failed", error=str(e))
            return {
                "message": self._get_fallback_question(current_phase),
                "phase": current_phase,
                "question_number": question_number + 1,
                "internal_notes": {"error": str(e)},
                "should_end": question_number >= total_questions,
            }

    async def evaluate_response(
        self,
        question: str,
        response: str,
        phase: str,
    ) -> dict[str, Any]:
        """Evaluate a candidate's response for scoring."""
        LLMContext.set(operation="interview_evaluate_response")

        rubric_context = ""
        if self.rubric_info and self.rubric_info.get('criteria'):
            criteria_list = [
                f"- {c.get('key', c.get('name', ''))}: {c.get('description', '')} (peso: {c.get('weight', 1)})"
                for c in self.rubric_info.get('criteria', [])
            ]
            rubric_context = f"""
## Criterios de Evaluacion:
{chr(10).join(criteria_list)}
"""

        system_prompt = f"""Eres un evaluador experto de entrevistas. Analiza la respuesta del candidato y proporciona una evaluacion estructurada.

{rubric_context}

Responde SIEMPRE en JSON con esta estructura:
{{
    "scores": {{
        "competency_key": {{
            "score": 3.5,
            "evidence": "cita textual de la respuesta que evidencia el score",
            "notes": "observaciones adicionales"
        }}
    }},
    "flags": ["bandera si hay inconsistencias o preocupaciones"],
    "follow_up_needed": true/false,
    "suggested_follow_up": "pregunta de seguimiento si es necesaria"
}}

Usa escala de 1-5:
1 = Muy por debajo de expectativas
2 = Por debajo de expectativas
3 = Cumple expectativas
4 = Supera expectativas
5 = Excepcional
"""

        user_prompt = f"""## Pregunta realizada:
{question}

## Respuesta del candidato:
{response}

## Fase de la entrevista:
{phase}

Evalua esta respuesta segun los criterios de la rubrica."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            return await llm_provider.complete_json(messages)
        except Exception as e:
            logger.error("interview_evaluate_response_failed", error=str(e))
            return {
                "scores": {},
                "flags": [],
                "follow_up_needed": False,
                "error": str(e),
            }

    async def generate_closing_message(self) -> str:
        """Generate the closing message for the interview."""
        if self.language == "es":
            return """Muchas gracias por tu tiempo y por compartir tu experiencia conmigo.
Ha sido una conversacion muy interesante.

Tu perfil sera evaluado y recibiras noticias sobre los siguientes pasos pronto.
Si tienes alguna pregunta adicional, no dudes en contactar al equipo de recursos humanos.

Te deseo mucho exito!"""
        else:
            return """Thank you so much for your time and for sharing your experience with me.
It has been a very interesting conversation.

Your profile will be evaluated and you will hear about next steps soon.
If you have any additional questions, please don't hesitate to contact the HR team.

Best of luck!"""

    def _get_fallback_greeting(self) -> str:
        """Get fallback greeting when AI fails."""
        job_title = self.job_info.get('title', 'esta oportunidad')
        if self.language == "es":
            return f"""Hola! Bienvenido/a a tu entrevista con TalentOS.

Soy tu entrevistador virtual y estoy aqui para conocerte mejor.
Me gustaria comenzar preguntandote: que te motivo a aplicar para {job_title}?"""
        else:
            return f"""Hi! Welcome to your interview with TalentOS.

I'm your virtual interviewer and I'm here to get to know you better.
I'd like to start by asking: what motivated you to apply for {job_title}?"""

    def _get_fallback_question(self, phase: str) -> str:
        """Get a fallback question based on phase."""
        fallbacks = {
            "introduction": "Cuentame un poco mas sobre tu trayectoria profesional.",
            "experience": "Cual ha sido tu logro profesional mas significativo?",
            "technical": "Describe un proyecto tecnico desafiante en el que hayas trabajado.",
            "behavioral": "Cuentame sobre una situacion dificil que hayas manejado en el trabajo.",
            "culture": "Que tipo de ambiente de trabajo te permite dar lo mejor de ti?",
            "closing": "Hay algo mas que te gustaria compartir o preguntar sobre la oportunidad?",
        }
        return fallbacks.get(phase, fallbacks["experience"])


async def create_orchestrator_for_session(
    session_id: UUID,
    job_id: Optional[UUID],
    candidate_id: UUID,
    db,  # SQLAlchemy session
) -> InterviewOrchestrator:
    """Create an orchestrator with all context loaded from database."""
    from app.models.job import Job
    from app.models.candidate import Candidate
    from app.models.rubric import Rubric

    job_info = None
    rubric_info = None

    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job_info = {
                "title": job.title,
                "description": job.description,
                "must_haves": job.must_haves or [],
                "nice_to_haves": job.nice_to_haves or [],
                "seniority": job.seniority.value if job.seniority else None,
                "responsibilities": job.responsibilities or [],
            }

            # Load rubric if job has one
            if job.rubric_id:
                rubric = db.query(Rubric).filter(Rubric.id == job.rubric_id).first()
                if rubric:
                    rubric_info = {
                        "name": rubric.name,
                        "criteria": [
                            {
                                "key": c.key,
                                "name": c.name,
                                "description": c.description,
                                "weight": c.weight,
                            }
                            for c in rubric.criteria
                        ],
                    }

    candidate_info = None
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if candidate:
        candidate_info = {
            "skills": candidate.skills or [],
            "experience": candidate.experience or [],
            "education": candidate.education or [],
            "summary": candidate.summary or candidate.ai_summary,
        }

    # Set LLM context
    LLMContext.set(session_id=session_id, job_id=job_id)

    return InterviewOrchestrator(
        job_info=job_info,
        candidate_info=candidate_info,
        rubric_info=rubric_info,
        language="es",
    )
