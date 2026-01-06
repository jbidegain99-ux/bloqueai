"""Dashboard and KPI schemas."""

from typing import Any, Optional

from app.schemas.base import BaseSchema


class DashboardKPIs(BaseSchema):
    """Dashboard KPI response."""

    # Candidate metrics
    total_candidates: int = 0
    candidates_with_interviews: int = 0
    interviews_completed: int = 0
    interviews_in_progress: int = 0

    # Job metrics
    active_jobs: int = 0
    total_applications: int = 0

    # Shortlist metrics
    shortlists_generated: int = 0
    candidates_shortlisted: int = 0
    candidates_contacted: int = 0
    candidates_hired: int = 0

    # Time metrics
    avg_time_to_shortlist_hours: Optional[float] = None
    avg_interview_duration_minutes: Optional[float] = None

    # Conversion rates
    interview_completion_rate: Optional[float] = None
    shortlist_to_contact_rate: Optional[float] = None
    contact_to_hire_rate: Optional[float] = None

    # Quality metrics
    avg_interview_score: Optional[float] = None
    flagged_interviews_count: int = 0
    score_overrides_count: int = 0

    # Trends (last 30 days)
    trends: dict[str, Any] = {}
