"""Initial migration - create all tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ENUM types
    # Companies table
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, index=True, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("size", sa.String(50), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("metadata", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("CANDIDATE", "EMPLOYER", "RECRUITER", "ADMIN", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("is_verified", sa.Boolean, default=False, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Candidates table
    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("phone_masked", sa.String(50), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("portfolio_url", sa.String(500), nullable=True),
        sa.Column("headline", sa.String(500), nullable=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("skills", postgresql.JSONB, default=list),
        sa.Column("experience", postgresql.JSONB, default=list),
        sa.Column("education", postgresql.JSONB, default=list),
        sa.Column("languages", postgresql.JSONB, default=list),
        sa.Column("certifications", postgresql.JSONB, default=list),
        sa.Column("ai_summary", sa.Text, nullable=True),
        sa.Column("ai_skills", postgresql.JSONB, default=list),
        sa.Column("competency_scores", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Resumes table
    op.create_table(
        "resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_size", sa.String(50), nullable=True),
        sa.Column("status", sa.Enum("PENDING", "PROCESSING", "COMPLETED", "FAILED", name="resume_status"), nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("parsed_data", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Rubrics table
    op.create_table(
        "rubrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_default", sa.Boolean, default=False, nullable=False),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("version", sa.Integer, default=1, nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rubrics.id"), nullable=True),
        sa.Column("min_score_threshold", sa.Float, default=3.0, nullable=False),
        sa.Column("max_candidates_shortlist", sa.Integer, default=10, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Rubric criteria table
    op.create_table(
        "rubric_criteria",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rubric_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rubrics.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("weight", sa.Float, default=1.0, nullable=False),
        sa.Column("order", sa.Integer, default=0, nullable=False),
        sa.Column("min_score", sa.Float, default=1.0, nullable=False),
        sa.Column("max_score", sa.Float, default=5.0, nullable=False),
        sa.Column("scoring_guidelines", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Jobs table
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), index=True, nullable=True),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("seniority", sa.Enum("INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "VP", "C_LEVEL", name="seniority_level"), nullable=False),
        sa.Column("salary_min", sa.Integer, nullable=True),
        sa.Column("salary_max", sa.Integer, nullable=True),
        sa.Column("salary_currency", sa.String(10), default="USD", nullable=True),
        sa.Column("modality", sa.Enum("REMOTE", "HYBRID", "ONSITE", name="job_modality"), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=True),
        sa.Column("must_haves", postgresql.JSONB, default=list),
        sa.Column("nice_to_haves", postgresql.JSONB, default=list),
        sa.Column("responsibilities", postgresql.JSONB, default=list),
        sa.Column("benefits", postgresql.JSONB, default=list),
        sa.Column("custom_questions", postgresql.JSONB, default=list),
        sa.Column("status", sa.Enum("DRAFT", "ACTIVE", "PAUSED", "CLOSED", name="job_status"), nullable=False),
        sa.Column("is_featured", sa.Boolean, default=False, nullable=False),
        sa.Column("rubric_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rubrics.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Interview sessions table
    op.create_table(
        "interview_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("status", sa.Enum("NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED", name="interview_status"), nullable=False),
        sa.Column("current_question_index", sa.Integer, default=0, nullable=False),
        sa.Column("total_questions", sa.Integer, default=12, nullable=False),
        sa.Column("interview_type", sa.String(50), default="general", nullable=False),
        sa.Column("language", sa.String(10), default="es", nullable=False),
        sa.Column("started_at", sa.String(50), nullable=True),
        sa.Column("completed_at", sa.String(50), nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("has_inconsistencies", sa.Boolean, default=False, nullable=False),
        sa.Column("confidence_score", sa.Integer, nullable=True),
        sa.Column("requires_review", sa.Boolean, default=False, nullable=False),
        sa.Column("full_transcript", sa.Text, nullable=True),
        sa.Column("masked_transcript", sa.Text, nullable=True),
        sa.Column("ai_analysis", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Interview messages table
    op.create_table(
        "interview_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id"), nullable=False),
        sa.Column("role", sa.Enum("SYSTEM", "AI", "CANDIDATE", name="message_role"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("content_masked", sa.Text, nullable=True),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("question_id", sa.String(100), nullable=True),
        sa.Column("metadata", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Candidate reports table
    op.create_table(
        "candidate_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id"), nullable=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("status", sa.Enum("PENDING", "GENERATING", "COMPLETED", "FAILED", name="report_status"), nullable=False),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("overall_score", sa.Float, nullable=True),
        sa.Column("confidence_score", sa.Integer, nullable=True),
        sa.Column("competency_scores", postgresql.JSONB, default=dict),
        sa.Column("skills_detected", postgresql.JSONB, default=list),
        sa.Column("skills_missing", postgresql.JSONB, default=list),
        sa.Column("skills_match_percentage", sa.Float, nullable=True),
        sa.Column("strengths", postgresql.JSONB, default=list),
        sa.Column("weaknesses", postgresql.JSONB, default=list),
        sa.Column("risks", postgresql.JSONB, default=list),
        sa.Column("recommendations", postgresql.JSONB, default=list),
        sa.Column("flags", postgresql.JSONB, default=list),
        sa.Column("requires_review", sa.Boolean, default=False, nullable=False),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("review_notes", sa.Text, nullable=True),
        sa.Column("score_overridden", sa.Boolean, default=False, nullable=False),
        sa.Column("original_score", sa.Float, nullable=True),
        sa.Column("override_reason", sa.Text, nullable=True),
        sa.Column("raw_ai_output", postgresql.JSONB, default=dict),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Shortlist items table
    op.create_table(
        "shortlist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidate_reports.id"), nullable=True),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("total_score", sa.Float, nullable=False),
        sa.Column("score_breakdown", postgresql.JSONB, default=dict),
        sa.Column("top_reasons", postgresql.JSONB, default=list),
        sa.Column("risks", postgresql.JSONB, default=list),
        sa.Column("match_details", postgresql.JSONB, default=dict),
        sa.Column("status", sa.Enum("PENDING", "REVIEWED", "CONTACTED", "INTERVIEW_SCHEDULED", "REJECTED", "HIRED", name="shortlist_status"), nullable=False),
        sa.Column("recruiter_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Audit logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("old_values", postgresql.JSONB, default=dict),
        sa.Column("new_values", postgresql.JSONB, default=dict),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Create indexes
    op.create_index("ix_users_company_id", "users", ["company_id"])
    op.create_index("ix_candidates_user_id", "candidates", ["user_id"])
    op.create_index("ix_resumes_candidate_id", "resumes", ["candidate_id"])
    op.create_index("ix_jobs_company_id", "jobs", ["company_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_interview_sessions_candidate_id", "interview_sessions", ["candidate_id"])
    op.create_index("ix_interview_sessions_status", "interview_sessions", ["status"])
    op.create_index("ix_candidate_reports_candidate_id", "candidate_reports", ["candidate_id"])
    op.create_index("ix_shortlist_items_job_id", "shortlist_items", ["job_id"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("audit_logs")
    op.drop_table("shortlist_items")
    op.drop_table("candidate_reports")
    op.drop_table("interview_messages")
    op.drop_table("interview_sessions")
    op.drop_table("jobs")
    op.drop_table("rubric_criteria")
    op.drop_table("rubrics")
    op.drop_table("resumes")
    op.drop_table("candidates")
    op.drop_table("users")
    op.drop_table("companies")

    # Drop ENUM types
    op.execute("DROP TYPE shortlist_status")
    op.execute("DROP TYPE report_status")
    op.execute("DROP TYPE message_role")
    op.execute("DROP TYPE interview_status")
    op.execute("DROP TYPE seniority_level")
    op.execute("DROP TYPE job_modality")
    op.execute("DROP TYPE job_status")
    op.execute("DROP TYPE resume_status")
    op.execute("DROP TYPE user_role")
