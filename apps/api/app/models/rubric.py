"""Rubric model for scoring calibration."""

from sqlalchemy import Column, String, Text, Float, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Rubric(BaseModel):
    """Scoring rubric for job evaluation."""

    __tablename__ = "rubrics"

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Version control for rubric changes
    version = Column(Integer, default=1, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("rubrics.id"), nullable=True)

    # Configuration
    min_score_threshold = Column(Float, default=3.0, nullable=False)
    max_candidates_shortlist = Column(Integer, default=10, nullable=False)

    # Relationships
    criteria = relationship(
        "RubricCriteria",
        back_populates="rubric",
        order_by="RubricCriteria.order",
    )
    jobs = relationship("Job", back_populates="rubric")

    def __repr__(self) -> str:
        return f"<Rubric {self.name} v{self.version}>"


class RubricCriteria(BaseModel):
    """Individual criteria within a rubric."""

    __tablename__ = "rubric_criteria"

    rubric_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rubrics.id"),
        nullable=False,
    )

    # Criteria details
    name = Column(String(100), nullable=False)
    key = Column(String(50), nullable=False)  # e.g., "technical_skills"
    description = Column(Text, nullable=True)

    # Weighting
    weight = Column(Float, default=1.0, nullable=False)  # Weight in scoring
    order = Column(Integer, default=0, nullable=False)

    # Scoring configuration
    min_score = Column(Float, default=1.0, nullable=False)
    max_score = Column(Float, default=5.0, nullable=False)

    # Evaluation guidelines
    scoring_guidelines = Column(JSONB, default=dict)
    # Example: {
    #   "1": "No demonstrated skill",
    #   "2": "Basic understanding",
    #   "3": "Competent",
    #   "4": "Proficient",
    #   "5": "Expert"
    # }

    # Relationships
    rubric = relationship("Rubric", back_populates="criteria")

    def __repr__(self) -> str:
        return f"<RubricCriteria {self.name} ({self.weight})>"
