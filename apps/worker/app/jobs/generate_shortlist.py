"""Shortlist generation job."""

import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings


def generate_shortlist(job_id: str, max_candidates: int = 10) -> dict:
    """
    Generate candidate shortlist for a job.

    This job:
    1. Gets all candidates with completed reports
    2. Calculates match scores based on job requirements
    3. Ranks candidates
    4. Creates shortlist entries
    """
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # Get job details
        job_result = db.execute(
            f"""SELECT must_haves, nice_to_haves, seniority, rubric_id
               FROM jobs WHERE id = '{job_id}'"""
        ).fetchone()

        if not job_result:
            return {"error": "Job not found"}

        must_haves = json.loads(job_result[0]) if job_result[0] else []
        nice_to_haves = json.loads(job_result[1]) if job_result[1] else []
        seniority = job_result[2]
        rubric_id = job_result[3]

        # Get rubric criteria weights
        criteria_weights = {}
        if rubric_id:
            criteria_result = db.execute(
                f"SELECT key, weight FROM rubric_criteria WHERE rubric_id = '{rubric_id}'"
            ).fetchall()
            criteria_weights = {r[0]: r[1] for r in criteria_result}

        # Default weights if no rubric
        if not criteria_weights:
            criteria_weights = {
                "technical_skills": 1.5,
                "communication": 1.0,
                "problem_solving": 1.2,
                "teamwork": 0.8,
                "leadership": 0.5,
            }

        # Get all candidates with completed reports
        candidates = db.execute(
            """SELECT c.id, c.skills, c.experience, c.competency_scores,
                      cr.id as report_id, cr.overall_score
               FROM candidates c
               JOIN candidate_reports cr ON cr.candidate_id = c.id
               WHERE cr.status = 'COMPLETED'
               ORDER BY cr.created_at DESC"""
        ).fetchall()

        # Calculate scores for each candidate
        ranked = []
        for candidate in candidates:
            cid, skills_json, exp_json, scores_json, report_id, base_score = candidate

            skills = json.loads(skills_json) if skills_json else []
            experience = json.loads(exp_json) if exp_json else []
            competency_scores = json.loads(scores_json) if scores_json else {}

            # Calculate must-have match
            skills_lower = " ".join(skills).lower()
            must_have_match = sum(1 for m in must_haves if m.lower() in skills_lower)
            must_have_score = must_have_match / len(must_haves) if must_haves else 1.0

            # Calculate nice-to-have match
            nice_have_match = sum(1 for n in nice_to_haves if n.lower() in skills_lower)
            nice_have_score = nice_have_match / len(nice_to_haves) if nice_to_haves else 0.0

            # Calculate weighted competency score
            total_weight = sum(criteria_weights.values())
            weighted_score = 0
            for key, weight in criteria_weights.items():
                if key in competency_scores:
                    score_data = competency_scores[key]
                    score = score_data.get("score", 0) if isinstance(score_data, dict) else score_data
                    weighted_score += score * weight

            competency_weighted = weighted_score / total_weight if total_weight > 0 else 0

            # Experience bonus
            exp_years = len(experience) * 1.5
            exp_bonus = min(0.5, max(-0.5, (exp_years - 3) * 0.1))

            # Calculate total score
            total_score = (
                must_have_score * 0.3 * 5 +
                nice_have_score * 0.1 * 5 +
                competency_weighted * 0.5 +
                exp_bonus * 0.1 * 5
            )

            # Generate reasons
            reasons = []
            if must_have_score >= 0.8:
                reasons.append("Cumple requisitos obligatorios")
            if competency_weighted >= 4.0:
                reasons.append("Excelente puntuación en competencias")
            if nice_have_score >= 0.6:
                reasons.append("Cumple requisitos deseables")

            # Generate risks
            risks = []
            if must_have_score < 0.7:
                risks.append("No cumple todos los requisitos obligatorios")
            if exp_bonus < 0:
                risks.append("Experiencia limitada para el nivel")

            ranked.append({
                "candidate_id": cid,
                "report_id": report_id,
                "total_score": round(total_score, 2),
                "score_breakdown": {
                    "must_have_match": round(must_have_score, 2),
                    "nice_to_have_match": round(nice_have_score, 2),
                    "competency_weighted": round(competency_weighted, 2),
                    "experience_bonus": round(exp_bonus, 2),
                },
                "top_reasons": reasons[:3],
                "risks": risks[:2],
            })

        # Sort by score
        ranked.sort(key=lambda x: x["total_score"], reverse=True)
        ranked = ranked[:max_candidates]

        # Clear existing pending shortlist items
        db.execute(
            f"DELETE FROM shortlist_items WHERE job_id = '{job_id}' AND status = 'PENDING'"
        )

        # Create shortlist items
        for i, entry in enumerate(ranked, 1):
            item_id = str(uuid4())
            db.execute(
                f"""INSERT INTO shortlist_items
                   (id, job_id, candidate_id, report_id, rank, total_score,
                    score_breakdown, top_reasons, risks, status,
                    created_at, updated_at)
                   VALUES (
                    '{item_id}', '{job_id}', '{entry['candidate_id']}',
                    '{entry['report_id']}', {i}, {entry['total_score']},
                    :breakdown, :reasons, :risks, 'PENDING',
                    :now, :now
                   )""",
                {
                    "breakdown": json.dumps(entry["score_breakdown"]),
                    "reasons": json.dumps(entry["top_reasons"]),
                    "risks": json.dumps(entry["risks"]),
                    "now": datetime.utcnow(),
                },
            )

        db.commit()
        return {"status": "success", "job_id": job_id, "candidates": len(ranked)}

    except Exception as e:
        db.rollback()
        return {"status": "error", "error": str(e)}
    finally:
        db.close()
