"""Pydantic schemas for TalentOS API."""

from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    RefreshRequest,
)
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.candidate import CandidateResponse, CandidateProfileResponse
from app.schemas.resume import ResumeUploadResponse, ResumeResponse
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobListResponse
from app.schemas.interview import (
    InterviewStartRequest,
    InterviewMessageRequest,
    InterviewMessageResponse,
    InterviewSessionResponse,
)
from app.schemas.report import CandidateReportResponse
from app.schemas.rubric import RubricCreate, RubricUpdate, RubricResponse
from app.schemas.shortlist import ShortlistItemResponse, ShortlistResponse

__all__ = [
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "RefreshRequest",
    "UserResponse",
    "UserUpdate",
    "CandidateResponse",
    "CandidateProfileResponse",
    "ResumeUploadResponse",
    "ResumeResponse",
    "JobCreate",
    "JobUpdate",
    "JobResponse",
    "JobListResponse",
    "InterviewStartRequest",
    "InterviewMessageRequest",
    "InterviewMessageResponse",
    "InterviewSessionResponse",
    "CandidateReportResponse",
    "RubricCreate",
    "RubricUpdate",
    "RubricResponse",
    "ShortlistItemResponse",
    "ShortlistResponse",
]
