"""Rubric schemas."""

from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import IDSchema, BaseSchema


class RubricCriteriaCreate(BaseSchema):
    """Rubric criteria creation."""

    name: str = Field(..., min_length=2, max_length=100)
    key: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    weight: float = Field(1.0, ge=0, le=10)
    order: int = Field(0, ge=0)
    min_score: float = Field(1.0, ge=0)
    max_score: float = Field(5.0, ge=0)
    scoring_guidelines: dict[str, str] = {}


class RubricCriteriaResponse(IDSchema):
    """Rubric criteria response."""

    rubric_id: UUID
    name: str
    key: str
    description: Optional[str] = None
    weight: float
    order: int
    min_score: float
    max_score: float
    scoring_guidelines: dict[str, str] = {}


class RubricCreate(BaseSchema):
    """Rubric creation request."""

    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    min_score_threshold: float = Field(3.0, ge=0, le=5)
    max_candidates_shortlist: int = Field(10, ge=1, le=100)
    criteria: list[RubricCriteriaCreate] = []


class RubricUpdate(BaseSchema):
    """Rubric update request."""

    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    min_score_threshold: Optional[float] = Field(None, ge=0, le=5)
    max_candidates_shortlist: Optional[int] = Field(None, ge=1, le=100)
    is_active: Optional[bool] = None
    criteria: Optional[list[RubricCriteriaCreate]] = None


class RubricResponse(IDSchema):
    """Rubric response."""

    name: str
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    version: int
    min_score_threshold: float
    max_candidates_shortlist: int
    criteria: list[RubricCriteriaResponse] = []


class RubricSimulationRequest(BaseSchema):
    """Request to simulate rubric changes."""

    job_id: UUID
    criteria_weights: dict[str, float]  # key -> new weight


class RubricSimulationResponse(BaseSchema):
    """Response from rubric simulation."""

    original_ranking: list[dict[str, Any]]
    new_ranking: list[dict[str, Any]]
    changes: list[dict[str, Any]]
