"""CV Builder service for generating CVs from wizard data."""

import io
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import structlog

from app.services.llm import llm_provider, LLMContext
from app.services.storage import get_storage_service

logger = structlog.get_logger()


# HTML template for CV PDF generation
CV_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CV - {name}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: #fff;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .name {{
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }}
        .headline {{
            font-size: 16px;
            color: #7f8c8d;
            margin-bottom: 10px;
        }}
        .contact {{
            font-size: 14px;
            color: #555;
        }}
        .contact span {{
            margin: 0 10px;
        }}
        .section {{
            margin-bottom: 25px;
        }}
        .section-title {{
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            text-transform: uppercase;
            border-bottom: 1px solid #bdc3c7;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }}
        .summary {{
            font-size: 14px;
            color: #555;
            text-align: justify;
        }}
        .entry {{
            margin-bottom: 15px;
        }}
        .entry-header {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }}
        .entry-title {{
            font-weight: bold;
            color: #2c3e50;
        }}
        .entry-date {{
            font-size: 13px;
            color: #7f8c8d;
        }}
        .entry-subtitle {{
            color: #555;
            font-size: 14px;
        }}
        .entry-description {{
            font-size: 14px;
            color: #555;
            margin-top: 5px;
        }}
        .achievements {{
            margin-top: 5px;
            padding-left: 20px;
        }}
        .achievements li {{
            font-size: 13px;
            color: #555;
            margin-bottom: 3px;
        }}
        .skills-container {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }}
        .skill-tag {{
            background: #ecf0f1;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 13px;
            color: #2c3e50;
        }}
        .languages-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }}
        .language-item {{
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px dotted #ddd;
        }}
        .language-name {{
            font-weight: 500;
        }}
        .language-level {{
            color: #7f8c8d;
            font-size: 13px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="name">{name}</div>
        <div class="headline">{headline}</div>
        <div class="contact">
            {email}{phone}{location}
        </div>
    </div>

    {summary_section}

    {experience_section}

    {education_section}

    {skills_section}

    {languages_section}
</body>
</html>
"""


async def generate_professional_summary(
    personal_info: dict,
    work_history: list[dict],
    education: list[dict],
    skills: dict,
    languages: list[dict],
) -> str:
    """Generate a professional summary using LLM."""

    # Build context for LLM
    context_parts = []

    if personal_info.get("headline"):
        context_parts.append(f"Headline: {personal_info['headline']}")

    if work_history:
        exp_summary = []
        for exp in work_history[:3]:  # Limit to recent 3
            exp_summary.append(
                f"- {exp.get('title', '')} at {exp.get('company', '')} ({exp.get('start_date', '')} - {exp.get('end_date', 'Present')})"
            )
        context_parts.append("Work Experience:\n" + "\n".join(exp_summary))

    if education:
        edu_summary = []
        for edu in education[:2]:
            edu_summary.append(f"- {edu.get('degree', '')} in {edu.get('field', '')} from {edu.get('institution', '')}")
        context_parts.append("Education:\n" + "\n".join(edu_summary))

    if skills.get("technical") or skills.get("soft"):
        all_skills = (skills.get("technical", []) + skills.get("soft", []))[:10]
        context_parts.append(f"Key Skills: {', '.join(all_skills)}")

    if languages:
        lang_summary = [f"{l.get('language', '')} ({l.get('level', '')})" for l in languages]
        context_parts.append(f"Languages: {', '.join(lang_summary)}")

    context = "\n\n".join(context_parts)

    messages = [
        {
            "role": "system",
            "content": """Eres un experto en redaccion de CVs profesionales.
Tu tarea es generar un resumen profesional conciso y atractivo (2-3 oraciones) basado en la informacion del candidato.
El resumen debe:
- Estar en tercera persona o primera persona profesional
- Destacar la experiencia relevante y habilidades clave
- Ser atractivo para reclutadores
- Estar en espanol
- No exceder 100 palabras

Responde SOLO con el resumen, sin explicaciones adicionales."""
        },
        {
            "role": "user",
            "content": f"Genera un resumen profesional para este candidato:\n\n{context}"
        }
    ]

    try:
        LLMContext.set(operation="cv_summary_generation")
        summary = await llm_provider.complete(messages, temperature=0.7, max_tokens=200)
        return summary.strip()
    except Exception as e:
        logger.error("cv_summary_generation_failed", error=str(e))
        # Fallback summary
        headline = personal_info.get("headline", "Profesional")
        return f"Profesional con experiencia en {headline.lower()}. Cuenta con habilidades tecnicas solidas y experiencia en entornos dinamicos."
    finally:
        LLMContext.clear()


def generate_cv_html(
    personal_info: dict,
    work_history: list[dict],
    education: list[dict],
    skills: dict,
    languages: list[dict],
    summary: str,
) -> str:
    """Generate HTML content for the CV."""

    # Personal info
    name = personal_info.get("name", "")
    headline = personal_info.get("headline", "")
    email = personal_info.get("email", "")
    phone = personal_info.get("phone", "")
    location = personal_info.get("location", "")

    # Format contact line
    contact_parts = []
    if email:
        contact_parts.append(f"<span>{email}</span>")
    if phone:
        contact_parts.append(f"<span>|</span><span>{phone}</span>")
    if location:
        contact_parts.append(f"<span>|</span><span>{location}</span>")

    # Summary section
    summary_section = ""
    if summary:
        summary_section = f"""
    <div class="section">
        <div class="section-title">Perfil Profesional</div>
        <p class="summary">{summary}</p>
    </div>
"""

    # Experience section
    experience_section = ""
    if work_history:
        entries = []
        for exp in work_history:
            achievements_html = ""
            achievements = exp.get("achievements", [])
            if achievements:
                achievements_items = "\n".join([f"<li>{a}</li>" for a in achievements if a])
                achievements_html = f'<ul class="achievements">{achievements_items}</ul>'

            entry = f"""
        <div class="entry">
            <div class="entry-header">
                <span class="entry-title">{exp.get('title', '')}</span>
                <span class="entry-date">{exp.get('start_date', '')} - {exp.get('end_date', 'Presente')}</span>
            </div>
            <div class="entry-subtitle">{exp.get('company', '')}</div>
            <div class="entry-description">{exp.get('description', '')}</div>
            {achievements_html}
        </div>
"""
            entries.append(entry)

        experience_section = f"""
    <div class="section">
        <div class="section-title">Experiencia Laboral</div>
        {''.join(entries)}
    </div>
"""

    # Education section
    education_section = ""
    if education:
        entries = []
        for edu in education:
            entry = f"""
        <div class="entry">
            <div class="entry-header">
                <span class="entry-title">{edu.get('degree', '')} en {edu.get('field', '')}</span>
                <span class="entry-date">{edu.get('year', '')}</span>
            </div>
            <div class="entry-subtitle">{edu.get('institution', '')}</div>
        </div>
"""
            entries.append(entry)

        education_section = f"""
    <div class="section">
        <div class="section-title">Educacion</div>
        {''.join(entries)}
    </div>
"""

    # Skills section
    skills_section = ""
    all_skills = (skills.get("technical", []) or []) + (skills.get("soft", []) or [])
    if all_skills:
        skill_tags = "\n".join([f'<span class="skill-tag">{s}</span>' for s in all_skills])
        skills_section = f"""
    <div class="section">
        <div class="section-title">Habilidades</div>
        <div class="skills-container">
            {skill_tags}
        </div>
    </div>
"""

    # Languages section
    languages_section = ""
    if languages:
        lang_items = []
        for lang in languages:
            lang_items.append(f"""
            <div class="language-item">
                <span class="language-name">{lang.get('language', '')}</span>
                <span class="language-level">{lang.get('level', '')}</span>
            </div>
""")

        languages_section = f"""
    <div class="section">
        <div class="section-title">Idiomas</div>
        <div class="languages-grid">
            {''.join(lang_items)}
        </div>
    </div>
"""

    # Build final HTML
    html = CV_HTML_TEMPLATE.format(
        name=name,
        headline=headline,
        email="".join(contact_parts),
        phone="",
        location="",
        summary_section=summary_section,
        experience_section=experience_section,
        education_section=education_section,
        skills_section=skills_section,
        languages_section=languages_section,
    )

    return html


async def generate_cv_pdf(html_content: str, candidate_id: UUID) -> Optional[str]:
    """Generate PDF from HTML and upload to storage. Returns file path."""
    try:
        # Try to use weasyprint for PDF generation
        try:
            from weasyprint import HTML

            pdf_buffer = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_buffer)
            pdf_buffer.seek(0)

            # Upload to storage
            storage = get_storage_service()
            if storage:
                file_path = storage.upload_file(
                    pdf_buffer,
                    f"cv_{candidate_id}.pdf",
                    "application/pdf",
                    folder="cv-builder",
                )
                logger.info("cv_pdf_generated", candidate_id=str(candidate_id), file_path=file_path)
                return file_path
            else:
                # No storage configured - return placeholder path
                logger.warning("storage_not_configured_for_pdf")
                return f"cv-builder/{candidate_id}.pdf"

        except ImportError:
            logger.warning("weasyprint_not_available_using_html_fallback")
            # Fallback: store HTML as file
            html_buffer = io.BytesIO(html_content.encode('utf-8'))

            storage = get_storage_service()
            if storage:
                file_path = storage.upload_file(
                    html_buffer,
                    f"cv_{candidate_id}.html",
                    "text/html",
                    folder="cv-builder",
                )
                return file_path
            return f"cv-builder/{candidate_id}.html"

    except Exception as e:
        logger.error("cv_pdf_generation_failed", candidate_id=str(candidate_id), error=str(e))
        return None


def build_parsed_data(
    personal_info: dict,
    work_history: list[dict],
    education: list[dict],
    skills: dict,
    languages: list[dict],
    summary: str,
) -> dict:
    """Build parsed data structure compatible with CV parser output."""

    # Transform work history to experience format
    experience = []
    for exp in work_history:
        experience.append({
            "title": exp.get("title", ""),
            "company": exp.get("company", ""),
            "start_date": exp.get("start_date", ""),
            "end_date": exp.get("end_date", "Presente"),
            "description": exp.get("description", ""),
            "achievements": exp.get("achievements", []),
        })

    # Transform education format
    education_list = []
    for edu in education:
        education_list.append({
            "degree": edu.get("degree", ""),
            "institution": edu.get("institution", ""),
            "field": edu.get("field", ""),
            "year": edu.get("year", ""),
        })

    # Transform languages format
    languages_list = []
    for lang in languages:
        languages_list.append({
            "language": lang.get("language", ""),
            "level": lang.get("level", ""),
        })

    # Combine all skills
    all_skills = (skills.get("technical", []) or []) + (skills.get("soft", []) or [])

    return {
        "name": personal_info.get("name", ""),
        "email": personal_info.get("email", ""),
        "phone": personal_info.get("phone", ""),
        "location": personal_info.get("location", ""),
        "headline": personal_info.get("headline", ""),
        "summary": summary,
        "skills": all_skills,
        "experience": experience,
        "education": education_list,
        "languages": languages_list,
    }


async def build_cv(
    personal_info: dict,
    work_history: list[dict],
    education: list[dict],
    skills: dict,
    languages: list[dict],
    candidate_id: UUID,
) -> dict:
    """
    Build a complete CV from wizard data.

    Returns:
        dict with keys: summary, html_content, file_path, parsed_data
    """
    logger.info("cv_builder_started", candidate_id=str(candidate_id))

    # Generate professional summary with AI
    summary = await generate_professional_summary(
        personal_info,
        work_history,
        education,
        skills,
        languages,
    )

    # Generate HTML content
    html_content = generate_cv_html(
        personal_info,
        work_history,
        education,
        skills,
        languages,
        summary,
    )

    # Generate PDF and upload
    file_path = await generate_cv_pdf(html_content, candidate_id)

    # Build parsed data for profile update
    parsed_data = build_parsed_data(
        personal_info,
        work_history,
        education,
        skills,
        languages,
        summary,
    )

    logger.info("cv_builder_completed", candidate_id=str(candidate_id), file_path=file_path)

    return {
        "summary": summary,
        "html_content": html_content,
        "file_path": file_path,
        "parsed_data": parsed_data,
    }
