"""Add leads table for landing page contact form

Revision ID: 002
Revises: 001
Create Date: 2024-01-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def index_exists(table_name: str, index_name: str) -> bool:
    """Check if an index exists on a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    indexes = inspector.get_indexes(table_name)
    return any(idx["name"] == index_name for idx in indexes)


def upgrade() -> None:
    # Leads table for landing page contact form - IDEMPOTENT
    if not table_exists("leads"):
        op.create_table(
            "leads",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("email", sa.String(255), nullable=False, index=True),
            sa.Column("company", sa.String(255), nullable=True),
            sa.Column("country", sa.String(100), nullable=True),
            sa.Column("phone", sa.String(50), nullable=True),
            sa.Column("roles_needed", sa.Text, nullable=True),
            sa.Column("message", sa.Text, nullable=True),
            sa.Column("contacted", sa.Boolean, default=False, nullable=False),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
        )

    # Create indexes if they don't exist
    if table_exists("leads"):
        if not index_exists("leads", "ix_leads_email"):
            op.create_index("ix_leads_email", "leads", ["email"])
        if not index_exists("leads", "ix_leads_created_at"):
            op.create_index("ix_leads_created_at", "leads", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_leads_created_at", table_name="leads")
    op.drop_index("ix_leads_email", table_name="leads")
    op.drop_table("leads")
