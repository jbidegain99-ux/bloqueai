"""Candidate ranking and shortlist generation service."""

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.job import Job
from app.models.report import CandidateReport
from app.models.rubric import Rubric, RubricCriteria
from app.models.shortlist import ShortlistItem


def calculate_must_have_match(
    candidate_skills: list[str],
    must_haves: list[str],
) -> float:
    """Calculate how many must-have requirements are met."""
    if not must_haves:
        return 1.0

    candidate_skills_lower = [s.lower() for s in candidate_skills]
    matched = sum(
        1 for req in must_haves if req.lower() in " ".join(candidate_skills_lower)
    )
    return matched / len(must_haves)


def calculate_nice_to_have_match(
    candidate_skills: list[str],
    nice_to_haves: list[str],
) -> float:
    """Calculate how many nice-to-have requirements are met."""
    if not nice_to_haves:
        return 0.0

    candidate_skills_lower = [s.lower() for s in candidate_skills]
    matched = sum(
        1 for req in nice_to_haves if req.lower() in " ".join(candidate_skills_lower)
    )
    return matched / len(nice_to_haves)


def calculate_weighted_competency_score(
    competency_scores: dict[str, Any],
    rubric_criteria: list[RubricCriteria],
) -> float:
    """Calculate weighted average of competency scores based on rubric."""
    if not competency_scores or not rubric_criteria:
        return 0.0

    total_weight = sum(c.weight for c in rubric_criteria)
    if total_weight == 0:
        return 0.0

    weighted_sum = 0.0
    for criteria in rubric_criteria:
        if criteria.key in competency_scores:
            score_data = competency_scores[criteria.key]
            score = score_data.get("score", 0) if isinstance(score_data, dict) else score_data
            weighted_sum += score * criteria.weight

    return weighted_sum / total_weight


def calculate_experience_bonus(
    experience: list[dict[str, Any]],
    seniority_level: str,
) -> float:
    """Calculate bonus based on experience relevance."""
    if not experience:
        return 0.0

    # Simple heuristic: years of experience
    years = len(experience) * 1.5  # Rough estimate

    seniority_years = {
        "INTERN": 0,
        "JUNIOR": 1,
        "MID": 3,
        "SENIOR": 5,
        "LEAD": 7,
        "MANAGER": 8,
        "DIRECTOR": 10,
        "VP": 12,
        "C_LEVEL": 15,
    }

    expected_years = seniority_years.get(seniority_level, 3)

    if years >= expected_years:
        return min(0.5, (years - expected_years) * 0.1)
    else:
        return max(-0.5, (years - expected_years) * 0.1)


def calculate_total_score(
    must_have_match: float,
    nice_to_have_match: float,
    competency_weighted: float,
    experience_bonus: float,
    weights: dict[str, float] = None,
) -> float:
    """Calculate total candidate score."""
    if weights is None:
        weights = {
            "must_have": 0.3,
            "nice_to_have": 0.1,
            "competency": 0.5,
            "experience": 0.1,
        }

    # Must-have is a filter - if below 0.5, heavy penalty
    if must_have_match < 0.5:
        must_have_contribution = must_have_match * 0.5
    else:
        must_have_contribution = must_have_match

    total = (
        must_have_contribution * weights["must_have"] * 5
        + nice_to_have_match * weights["nice_to_have"] * 5
        + competency_weighted * weights["competency"]
        + experience_bonus * weights["experience"] * 5
    )

    return max(0, min(5, total))


def generate_top_reasons(
    score_breakdown: dict[str, float],
    report: CandidateReport,
) -> list[str]:
    """Generate top 3 reasons for candidate ranking."""
    reasons = []

    if score_breakdown.get("must_have_match", 0) >= 0.8:
        reasons.append("Cumple con la mayoría de requisitos obligatorios")

    if score_breakdown.get("competency_weighted", 0) >= 4.0:
        reasons.append("Excelente puntuación en competencias clave")
    elif score_breakdown.get("competency_weighted", 0) >= 3.5:
        reasons.append("Buena puntuación en competencias")

    if report and report.strengths:
        for strength in report.strengths[:2]:
            if len(reasons) < 3:
                reasons.append(strength)

    if score_breakdown.get("nice_to_have_match", 0) >= 0.6:
        if len(reasons) < 3:
            reasons.append("Cumple requisitos deseables adicionales")

    if score_breakdown.get("experience_bonus", 0) > 0:
        if len(reasons) < 3:
            reasons.append("Experiencia relevante para el nivel requerido")

    return reasons[:3]


def generate_risks(
    score_breakdown: dict[str, float],
    report: CandidateReport,
) -> list[str]:
    """Generate potential risks for candidate."""
    risks = []

    if score_breakdown.get("must_have_match", 0) < 0.7:
        risks.append("No cumple algunos requisitos obligatorios")

    if score_breakdown.get("experience_bonus", 0) < 0:
        risks.append("Experiencia por debajo del nivel esperado")

    if report:
        if report.risks:
            risks.extend(report.risks[:2])
        if report.requires_review:
            risks.append("Entrevista marcada para revisión")
        if report.flags:
            risks.extend(report.flags[:1])

    return risks[:3]


def calculate_cv_score(
    must_have_match: float,
    nice_to_have_match: float,
    experience_bonus: float,
) -> float:
    """Calculate CV-based score (0-100 scale)."""
    # Weighted combination of CV-derived factors
    raw_score = (
        must_have_match * 50  # Up to 50 points for must-haves
        + nice_to_have_match * 25  # Up to 25 points for nice-to-haves
        + max(0, experience_bonus + 0.5) * 25  # Up to 25 points for experience (normalized)
    )
    return max(0, min(100, raw_score))


def calculate_interview_score(report: CandidateReport) -> float:
    """Calculate interview score (0-100 scale) from report."""
    if not report or not report.overall_score:
        return 0.0
    # overall_score is 1-5, convert to 0-100
    return (report.overall_score / 5.0) * 100


def rank_candidates_for_job(
    db: Session,
    job: Job,
    max_candidates: int = 10,
) -> list[dict[str, Any]]:
    """Rank all candidates for a job and return top matches."""
    import structlog
    from app.models.report import ReportStatus
    logger = structlog.get_logger()

    # Score weights (configurable)
    CV_WEIGHT = 0.4  # 40% from CV
    INTERVIEW_WEIGHT = 0.6  # 60% from interview

    # Get job requirements
    must_haves = job.must_haves or []
    nice_to_haves = job.nice_to_haves or []

    logger.info("ranking_candidates", job_id=str(job.id), must_haves=must_haves, nice_to_haves=nice_to_haves)

    # Get rubric criteria
    rubric_criteria = []
    if job.rubric_id:
        rubric = db.query(Rubric).filter(Rubric.id == job.rubric_id).first()
        if rubric:
            rubric_criteria = rubric.criteria

    # If no rubric, use default criteria
    if not rubric_criteria:
        rubric_criteria = get_default_criteria()

    # Get ALL candidates (not just those with completed reports)
    candidates = db.query(Candidate).all()

    logger.info("found_candidates", count=len(candidates))

    ranked = []
    for candidate in candidates:
        # Get latest COMPLETED report (if any)
        report = (
            db.query(CandidateReport)
            .filter(CandidateReport.candidate_id == candidate.id)
            .filter(CandidateReport.status == ReportStatus.COMPLETED)
            .order_by(CandidateReport.created_at.desc())
            .first()
        )

        # Calculate scores
        candidate_skills = candidate.skills or []
        experience = candidate.experience or []

        # Skip candidates without skills AND without report (no data to rank)
        if not candidate_skills and not report:
            logger.debug("skipping_candidate_no_data", candidate_id=str(candidate.id))
            continue

        # Use report competency scores if available, otherwise use candidate's stored scores
        competency_scores = {}
        if report:
            competency_scores = report.competency_scores or {}
        elif candidate.competency_scores:
            competency_scores = candidate.competency_scores

        must_have_match = calculate_must_have_match(candidate_skills, must_haves)
        nice_to_have_match = calculate_nice_to_have_match(candidate_skills, nice_to_haves)
        competency_weighted = calculate_weighted_competency_score(
            competency_scores, rubric_criteria
        )
        experience_bonus = calculate_experience_bonus(experience, job.seniority.value)

        # Calculate CV and Interview scores (0-100 scale)
        cv_score = calculate_cv_score(must_have_match, nice_to_have_match, experience_bonus)
        interview_score = calculate_interview_score(report)

        # Calculate final score as weighted average
        # If no interview, use CV score only but penalize slightly
        if interview_score > 0:
            final_score = (cv_score * CV_WEIGHT) + (interview_score * INTERVIEW_WEIGHT)
        else:
            # No interview completed - use CV only with 20% penalty
            final_score = cv_score * 0.8

        # Get top competencies from report or candidate
        top_competencies = []
        if competency_scores:
            sorted_competencies = sorted(
                competency_scores.items(),
                key=lambda x: (x[1].get("score", 0) if isinstance(x[1], dict) else x[1]),
                reverse=True
            )
            top_competencies = [
                {"name": k, "score": (v.get("score", 0) if isinstance(v, dict) else v)}
                for k, v in sorted_competencies[:3]
            ]

        # Determine status
        status = "COMPLETED" if report else "PENDING"

        # Count flags
        flags_count = len(report.flags) if report and report.flags else 0

        score_breakdown = {
            "must_have_match": round(must_have_match, 2),
            "nice_to_have_match": round(nice_to_have_match, 2),
            "competency_weighted": round(competency_weighted, 2),
            "experience_bonus": round(experience_bonus, 2),
            "cv_score": round(cv_score, 1),
            "interview_score": round(interview_score, 1),
        }

        ranked.append({
            "candidate": candidate,
            "report": report,
            "final_score": round(final_score, 1),
            "cv_score": round(cv_score, 1),
            "interview_score": round(interview_score, 1),
            "total_score": round(final_score / 20, 2),  # Backwards compat: 0-5 scale
            "score_breakdown": score_breakdown,
            "top_reasons": generate_top_reasons(score_breakdown, report),
            "risks": generate_risks(score_breakdown, report),
            "top_competencies": top_competencies,
            "flags_count": flags_count,
            "status": status,
        })

    logger.info("ranked_candidates", count=len(ranked))

    # Sort by final_score descending
    ranked.sort(key=lambda x: x["final_score"], reverse=True)

    # Return top N
    return ranked[:max_candidates]


class DefaultCriteria:
    """Default rubric criteria when no rubric is defined."""

    def __init__(self, key: str, weight: float):
        self.key = key
        self.weight = weight


def get_default_criteria() -> list[DefaultCriteria]:
    """Get default evaluation criteria."""
    return [
        DefaultCriteria("technical_skills", 1.5),
        DefaultCriteria("communication", 1.0),
        DefaultCriteria("problem_solving", 1.2),
        DefaultCriteria("teamwork", 0.8),
        DefaultCriteria("leadership", 0.5),
        DefaultCriteria("adaptability", 0.5),
        DefaultCriteria("cultural_fit", 0.5),
    ]
