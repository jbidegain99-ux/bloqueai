"""Job Copilot AI schemas."""

from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


class CopilotDescriptionRequest(BaseSchema):
    """Request schema for AI job description suggestion."""

    title: str = Field(..., min_length=2, max_length=255, description="Job title")
    category: str = Field(..., description="Job category (e.g., TECHNOLOGY, HEALTHCARE)")
    seniority: str = Field("MID", description="Seniority level")
    company_context: Optional[str] = Field(None, description="Company description for context")
    partial_description: Optional[str] = Field(None, description="Existing description to improve")


class CopilotDescriptionResponse(BaseSchema):
    """Response schema for AI job description suggestion."""

    description: Optional[str] = None
    suggestions: Optional[list[str]] = None
    error: Optional[str] = None


class CopilotRequirementsRequest(BaseSchema):
    """Request schema for AI job requirements suggestion."""

    title: str = Field(..., min_length=2, max_length=255, description="Job title")
    category: str = Field(..., description="Job category")
    seniority: str = Field("MID", description="Seniority level")
    description: Optional[str] = Field(None, description="Job description for context")


class CopilotRequirementsResponse(BaseSchema):
    """Response schema for AI job requirements suggestion."""

    must_haves: Optional[list[str]] = None
    nice_to_haves: Optional[list[str]] = None
    reasoning: Optional[str] = None
    error: Optional[str] = None


class CopilotQuestionsRequest(BaseSchema):
    """Request schema for AI interview questions suggestion."""

    title: str = Field(..., min_length=2, max_length=255, description="Job title")
    category: str = Field(..., description="Job category")
    seniority: str = Field("MID", description="Seniority level")
    must_haves: Optional[list[str]] = Field(None, description="Must-have skills")
    description: Optional[str] = Field(None, description="Job description for context")


class CopilotQuestionItem(BaseSchema):
    """Single interview question."""

    question: str
    type: str
    evaluates: str


class CopilotQuestionsResponse(BaseSchema):
    """Response schema for AI interview questions suggestion."""

    questions: Optional[list[CopilotQuestionItem]] = None
    notes: Optional[str] = None
    error: Optional[str] = None


class CategoryFieldItem(BaseSchema):
    """Category-specific field definition."""

    key: str
    label: str
    type: str
    required: Optional[bool] = None
    options: Optional[list[str]] = None


class CategoryFieldsResponse(BaseSchema):
    """Response schema for category-specific fields."""

    category: str
    fields: list[CategoryFieldItem]
