"""Add HNSW indexes for vector search

Revision ID: 015_vector_indexes
Revises: 014_embeddings
Create Date: 2026-02-23
"""

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "015_vector_indexes"
down_revision: str = "014_embeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # HNSW index for candidate embeddings (cosine similarity)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_candidate_embedding_hnsw
        ON candidates
        USING hnsw (profile_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )

    # HNSW index for job embeddings (cosine similarity)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_job_embedding_hnsw
        ON jobs
        USING hnsw (job_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_candidate_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS idx_job_embedding_hnsw")
