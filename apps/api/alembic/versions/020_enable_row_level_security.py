"""Enable Row Level Security on all public tables.

Revision ID: 020
Revises: 019
Create Date: 2026-02-25

Enables RLS on all 30 public tables with appropriate policies:
- User/candidate tables: own-record access
- Company tables: company-member access via get_user_company_id()
- Job tables: published jobs public, company manages own
- Interview/matching: candidate sees own, company sees related
- EOR/Payroll: company-scoped via client_company_id/client_id
- Billing: company-scoped
- System tables: service_role only (no authenticated policies)
"""

import os
from alembic import op
from sqlalchemy import text

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "..",
        "supabase", "migrations", "20260225_enable_rls.sql",
    )
    migration_path = os.path.normpath(migration_path)

    if not os.path.exists(migration_path):
        print("  [SKIP] RLS SQL file not found — skipping (non-Supabase environment)")
        return

    with open(migration_path) as f:
        sql = f.read()

    # Skip RLS on local dev (requires Supabase auth schema)
    conn = op.get_bind()
    result = conn.execute(text("SELECT 1 FROM pg_namespace WHERE nspname = 'auth'"))
    if not result.fetchone():
        print("  [SKIP] auth schema not found — skipping RLS (local dev, not Supabase)")
        return

    conn.execute(text(sql))


def downgrade() -> None:
    # Drop all RLS policies and disable RLS
    tables = [
        "users", "companies", "candidates", "resumes",
        "jobs", "applications",
        "rubrics", "rubric_criteria",
        "candidate_job_matches", "interview_sessions", "interview_messages",
        "interview_invitations", "video_interviews",
        "candidate_reports", "shortlist_items",
        "placements", "assignments",
        "eor_employees", "eor_payroll_runs", "eor_payroll_items",
        "eor_vacation_requests",
        "plans", "subscriptions", "invoices", "usage_records",
        "audit_logs", "system_settings", "llm_logs", "leads",
        "alembic_version",
    ]

    # Drop all policies for each table, then disable RLS
    for table in tables:
        # Get and drop all policies
        op.execute(f"""
            DO $$
            DECLARE pol RECORD;
            BEGIN
                FOR pol IN
                    SELECT policyname FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = '{table}'
                LOOP
                    EXECUTE format('DROP POLICY IF EXISTS %I ON public.{table}', pol.policyname);
                END LOOP;
            END $$;
        """)
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")

    # Drop helper functions
    op.execute("DROP FUNCTION IF EXISTS public.get_user_company_id()")
    op.execute("DROP FUNCTION IF EXISTS public.get_user_candidate_id()")
    op.execute("DROP FUNCTION IF EXISTS public.get_user_role()")

    # Drop RLS-specific indexes
    op.execute("""
        DO $$
        DECLARE idx RECORD;
        BEGIN
            FOR idx IN
                SELECT indexname FROM pg_indexes
                WHERE schemaname = 'public' AND indexname LIKE 'idx_rls_%'
            LOOP
                EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.indexname);
            END LOOP;
        END $$;
    """)
