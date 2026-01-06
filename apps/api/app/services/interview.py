"""Interview service for AI-powered interviews."""

from typing import Any, Optional
from uuid import UUID

from app.services.llm import llm_provider
from app.services.cv_parser import mask_pii


# Default interview questions (Spanish)
DEFAULT_QUESTIONS = [
    {
        "id": "intro",
        "category": "introduction",
        "question": "¡Hola! Soy tu entrevistador virtual de TalentOS. Antes de comenzar, ¿podrías presentarte brevemente y contarme qué te motivó a aplicar a esta oportunidad?",
    },
    {
        "id": "experience",
        "category": "experience",
        "question": "Cuéntame sobre tu experiencia profesional más relevante. ¿Cuál ha sido tu rol más significativo y qué lograste en él?",
    },
    {
        "id": "technical_1",
        "category": "technical",
        "question": "Describe un proyecto técnico desafiante en el que hayas trabajado. ¿Cuál fue tu rol específico y qué tecnologías utilizaste?",
    },
    {
        "id": "problem_solving",
        "category": "problem_solving",
        "question": "Cuéntame sobre un problema complejo que hayas tenido que resolver en tu trabajo. ¿Cómo lo abordaste y cuál fue el resultado?",
    },
    {
        "id": "teamwork",
        "category": "teamwork",
        "question": "Describe cómo has trabajado en equipo en proyectos anteriores. ¿Cómo manejas los desacuerdos o conflictos con compañeros?",
    },
    {
        "id": "leadership",
        "category": "leadership",
        "question": "¿Has tenido oportunidades de liderar proyectos o mentorear a otros? Cuéntame sobre esa experiencia.",
    },
    {
        "id": "technical_2",
        "category": "technical",
        "question": "¿Cómo te mantienes actualizado con las nuevas tecnologías y tendencias en tu campo? ¿Qué has aprendido recientemente?",
    },
    {
        "id": "failure",
        "category": "behavioral",
        "question": "Todos cometemos errores. Cuéntame sobre un error o fracaso profesional y qué aprendiste de esa experiencia.",
    },
    {
        "id": "motivation",
        "category": "motivation",
        "question": "¿Qué te motiva profesionalmente? ¿Dónde te ves en los próximos 3-5 años?",
    },
    {
        "id": "culture",
        "category": "culture_fit",
        "question": "¿Qué tipo de ambiente de trabajo te permite dar lo mejor de ti? ¿Cómo describes tu estilo de trabajo ideal?",
    },
    {
        "id": "strengths",
        "category": "self_assessment",
        "question": "¿Cuáles consideras que son tus principales fortalezas y áreas de mejora?",
    },
    {
        "id": "closing",
        "category": "closing",
        "question": "Para finalizar, ¿hay algo más que te gustaría compartir o alguna pregunta que tengas sobre la oportunidad?",
    },
]


def get_interview_questions(
    job_id: Optional[UUID] = None,
    custom_questions: list[str] = None,
) -> list[dict[str, Any]]:
    """Get interview questions, including job-specific ones."""
    questions = DEFAULT_QUESTIONS.copy()

    # Add custom questions if provided
    if custom_questions:
        for i, q in enumerate(custom_questions[:3]):  # Limit to 3 custom questions
            questions.insert(
                -1,  # Before closing
                {
                    "id": f"custom_{i}",
                    "category": "job_specific",
                    "question": q,
                },
            )

    return questions


async def generate_follow_up_question(
    messages: list[dict[str, str]],
    current_question: dict[str, Any],
    candidate_response: str,
) -> Optional[str]:
    """Generate a follow-up question based on candidate response."""
    system_prompt = """Eres un entrevistador experto. Basándote en la respuesta del candidato,
decide si necesitas hacer una pregunta de seguimiento para aclarar o profundizar.

Si la respuesta es clara y completa, responde con: {"follow_up": null}
Si necesitas más información, responde con: {"follow_up": "tu pregunta de seguimiento"}

Sé conciso y profesional. Las preguntas de seguimiento deben ser específicas."""

    messages_for_llm = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"""Pregunta original: {current_question['question']}
Respuesta del candidato: {candidate_response}

¿Necesitas una pregunta de seguimiento?""",
        },
    ]

    result = await llm_provider.complete_json(messages_for_llm)
    return result.get("follow_up")


async def generate_candidate_report(
    transcript: str,
    candidate_info: dict[str, Any],
    job_info: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate comprehensive candidate report from interview."""
    job_context = ""
    if job_info:
        job_context = f"""
Información del puesto:
- Título: {job_info.get('title', 'No especificado')}
- Requisitos obligatorios: {', '.join(job_info.get('must_haves', []))}
- Requisitos deseables: {', '.join(job_info.get('nice_to_haves', []))}
- Nivel: {job_info.get('seniority', 'No especificado')}
"""

    system_prompt = f"""Eres un experto en evaluación de talento. Analiza la siguiente transcripción de entrevista y genera un reporte detallado del candidato.
{job_context}
Evalúa las siguientes competencias en una escala de 1 a 5:
- technical_skills: Habilidades técnicas
- communication: Comunicación
- problem_solving: Resolución de problemas
- teamwork: Trabajo en equipo
- leadership: Liderazgo
- adaptability: Adaptabilidad
- cultural_fit: Fit cultural

Genera un JSON con la siguiente estructura:
{{
    "summary": "Resumen ejecutivo del candidato (2-3 oraciones)",
    "overall_score": 3.5,  // Promedio ponderado 1-5
    "confidence_score": 85,  // 0-100, qué tan seguro estás de la evaluación
    "competency_scores": {{
        "technical_skills": {{"score": 4.0, "notes": "explicación"}},
        // ... otras competencias
    }},
    "skills_detected": ["skill1", "skill2"],
    "strengths": ["fortaleza1", "fortaleza2", "fortaleza3"],
    "weaknesses": ["área de mejora1"],
    "risks": ["riesgo potencial si hay"],
    "recommendations": ["recomendación1", "recomendación2"],
    "flags": ["bandera si hay inconsistencias o preocupaciones"]
}}

Sé objetivo, profesional y fundamenta tus evaluaciones en evidencia del transcript."""

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"""Información del candidato:
{candidate_info}

Transcripción de la entrevista:
{transcript[:12000]}

Genera el reporte de evaluación.""",
        },
    ]

    return await llm_provider.complete_json(messages)


def build_transcript(messages: list[dict[str, Any]]) -> str:
    """Build transcript string from messages."""
    lines = []
    for msg in messages:
        role = "Entrevistador" if msg["role"] in ("AI", "SYSTEM") else "Candidato"
        lines.append(f"{role}: {msg['content']}")
    return "\n\n".join(lines)


def build_masked_transcript(messages: list[dict[str, Any]]) -> str:
    """Build PII-masked transcript from messages."""
    transcript = build_transcript(messages)
    return mask_pii(transcript)
