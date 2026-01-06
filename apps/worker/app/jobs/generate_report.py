"""Candidate report generation job."""

from uuid import UUID
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings


def generate_candidate_report(
    candidate_id: str,
    session_id: str,
    job_id: str = None,
) -> dict:
    """
    Generate a comprehensive candidate report.

    This job:
    1. Gets interview transcript
    2. Gets candidate info
    3. Uses LLM to analyze and generate report
    4. Updates the database with results
    """
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        import json

        # Get or create report
        report_result = db.execute(
            f"""SELECT id FROM candidate_reports
               WHERE candidate_id = '{candidate_id}'
               AND session_id = '{session_id}'
               ORDER BY created_at DESC LIMIT 1"""
        ).fetchone()

        if report_result:
            report_id = report_result[0]
            # Update to generating
            db.execute(
                f"UPDATE candidate_reports SET status = 'GENERATING' WHERE id = '{report_id}'"
            )
            db.commit()
        else:
            return {"error": "Report not found"}

        # Get transcript
        session_result = db.execute(
            f"SELECT full_transcript, masked_transcript FROM interview_sessions WHERE id = '{session_id}'"
        ).fetchone()

        if not session_result:
            return {"error": "Interview session not found"}

        transcript = session_result[0] or session_result[1] or ""

        # Get candidate info
        candidate_result = db.execute(
            f"SELECT skills, experience FROM candidates WHERE id = '{candidate_id}'"
        ).fetchone()

        candidate_info = {}
        if candidate_result:
            candidate_info = {
                "skills": json.loads(candidate_result[0]) if candidate_result[0] else [],
                "experience": json.loads(candidate_result[1]) if candidate_result[1] else [],
            }

        # Get job info if provided
        job_info = None
        if job_id:
            job_result = db.execute(
                f"SELECT title, must_haves, nice_to_haves, seniority FROM jobs WHERE id = '{job_id}'"
            ).fetchone()
            if job_result:
                job_info = {
                    "title": job_result[0],
                    "must_haves": json.loads(job_result[1]) if job_result[1] else [],
                    "nice_to_haves": json.loads(job_result[2]) if job_result[2] else [],
                    "seniority": job_result[3],
                }

        # Generate report with LLM
        report_data = _generate_report_with_llm(transcript, candidate_info, job_info)

        # Update report
        db.execute(
            f"""UPDATE candidate_reports SET
               status = 'COMPLETED',
               summary = :summary,
               overall_score = :score,
               confidence_score = :confidence,
               competency_scores = :competencies,
               skills_detected = :skills,
               strengths = :strengths,
               weaknesses = :weaknesses,
               risks = :risks,
               recommendations = :recommendations,
               raw_ai_output = :raw,
               updated_at = :now
               WHERE id = '{report_id}'""",
            {
                "summary": report_data.get("summary"),
                "score": report_data.get("overall_score"),
                "confidence": report_data.get("confidence_score"),
                "competencies": json.dumps(report_data.get("competency_scores", {})),
                "skills": json.dumps(report_data.get("skills_detected", [])),
                "strengths": json.dumps(report_data.get("strengths", [])),
                "weaknesses": json.dumps(report_data.get("weaknesses", [])),
                "risks": json.dumps(report_data.get("risks", [])),
                "recommendations": json.dumps(report_data.get("recommendations", [])),
                "raw": json.dumps(report_data),
                "now": datetime.utcnow(),
            },
        )

        # Update candidate competency scores
        db.execute(
            f"""UPDATE candidates SET
               competency_scores = :scores,
               ai_summary = :summary,
               updated_at = :now
               WHERE id = '{candidate_id}'""",
            {
                "scores": json.dumps(report_data.get("competency_scores", {})),
                "summary": report_data.get("summary"),
                "now": datetime.utcnow(),
            },
        )

        db.commit()
        return {"status": "success", "report_id": str(report_id)}

    except Exception as e:
        if "report_id" in locals():
            db.execute(
                f"UPDATE candidate_reports SET status = 'FAILED' WHERE id = '{report_id}'"
            )
            db.commit()
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


def _generate_report_with_llm(
    transcript: str,
    candidate_info: dict,
    job_info: dict = None,
) -> dict:
    """Generate report using LLM or stub."""
    if settings.use_stub_llm:
        import hashlib

        hash_val = hashlib.md5(transcript.encode()).hexdigest()
        base_score = 3.0 + (int(hash_val[:2], 16) % 20) / 10

        return {
            "summary": f"Candidato con perfil sólido. Demuestra experiencia relevante.",
            "overall_score": round(base_score, 1),
            "confidence_score": 85,
            "competency_scores": {
                "technical_skills": {"score": round(base_score + 0.2, 1), "notes": "Buen dominio técnico"},
                "communication": {"score": round(base_score - 0.1, 1), "notes": "Buena comunicación"},
                "problem_solving": {"score": round(base_score + 0.1, 1), "notes": "Capacidad analítica"},
                "teamwork": {"score": round(base_score - 0.2, 1), "notes": "Trabajo en equipo"},
                "leadership": {"score": round(base_score - 0.4, 1), "notes": "Potencial de liderazgo"},
            },
            "skills_detected": candidate_info.get("skills", ["Python", "JavaScript"]),
            "strengths": ["Experiencia técnica", "Buena comunicación", "Actitud proactiva"],
            "weaknesses": ["Podría mejorar en liderazgo"],
            "risks": ["Sin riesgos significativos"],
            "recommendations": ["Adecuado para roles mid-senior"],
        }
    else:
        import httpx

        job_context = ""
        if job_info:
            job_context = f"\nJob: {job_info['title']}, Must-haves: {job_info['must_haves']}"

        response = httpx.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": f"""Analyze interview and generate candidate report. Return JSON with:
summary, overall_score (1-5), confidence_score (0-100), competency_scores (dict),
skills_detected, strengths, weaknesses, risks, recommendations.{job_context}""",
                    },
                    {"role": "user", "content": transcript[:12000]},
                ],
                "temperature": 0.3,
            },
            timeout=90.0,
        )
        response.raise_for_status()
        import json

        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
