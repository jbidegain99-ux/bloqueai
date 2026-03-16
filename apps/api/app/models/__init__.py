"""Database models for TalentOS."""

from app.models.user import User
from app.models.company import Company
from app.models.candidate import Candidate
from app.models.resume import Resume
from app.models.job import Job, JobStatus, JobCategory
from app.models.interview import InterviewSession, InterviewMessage
from app.models.report import CandidateReport
from app.models.rubric import Rubric, RubricCriteria
from app.models.shortlist import ShortlistItem
from app.models.audit import AuditLog
from app.models.lead import Lead
from app.models.llm_log import LLMLog
from app.models.invitation import InterviewInvitation
from app.models.application import Application, ApplicationStatus
from app.models.settings import SystemSettings
from app.models.placement import Placement, Assignment, PlacementStatus, AssignmentStatus, PlacementType
from app.models.cache import CVAnalysisCache
from app.models.payroll import (
    Employee, Contract, Attendance, PayrollRun, PayrollLine,
    Payslip, DeductionType, TaxConfig,
    PayrollDeductionBreakdown, PayrollProvision,
    PayFrequency, ContractType, AttendanceType, PayrollRunStatus, DeductionCalcType,
    EmployeeStatus, EmploymentType, DocumentType, PaymentMethod,
    DeductionCategory, ProvisionType,
)
from app.models.eor import (
    EOREmployee,
    EORPayrollRun,
    EORPayrollItem,
    EORVacationRequest,
    EOREmployeeStatus,
    EORContractType,
    EORPaymentFrequency,
    EORPayrollRunStatus,
    VacationRequestStatus,
    AFPProvider,
    BankAccountType,
)
from app.models.billing import (
    Plan,
    Subscription,
    Invoice,
    UsageRecord,
    PlanTier,
    SubscriptionStatus,
    InvoiceStatus,
)
from app.models.match import CandidateJobMatch, MatchStatus
from app.models.video_interview import VideoInterview, VideoInterviewStatus

__all__ = [
    "User",
    "Company",
    "Candidate",
    "Resume",
    "Job",
    "JobStatus",
    "JobCategory",
    "InterviewSession",
    "InterviewMessage",
    "CandidateReport",
    "Rubric",
    "RubricCriteria",
    "ShortlistItem",
    "AuditLog",
    "Lead",
    "LLMLog",
    "InterviewInvitation",
    "Application",
    "ApplicationStatus",
    "SystemSettings",
    "Placement",
    "Assignment",
    "PlacementStatus",
    "AssignmentStatus",
    "PlacementType",
    "Employee",
    "Contract",
    "Attendance",
    "PayrollRun",
    "PayrollLine",
    "Payslip",
    "DeductionType",
    "TaxConfig",
    "PayrollDeductionBreakdown",
    "PayrollProvision",
    "PayFrequency",
    "ContractType",
    "AttendanceType",
    "PayrollRunStatus",
    "DeductionCalcType",
    "EmployeeStatus",
    "EmploymentType",
    "DocumentType",
    "PaymentMethod",
    "DeductionCategory",
    "ProvisionType",
    "CVAnalysisCache",
    "EOREmployee",
    "EORPayrollRun",
    "EORPayrollItem",
    "EORVacationRequest",
    "EOREmployeeStatus",
    "EORContractType",
    "EORPaymentFrequency",
    "EORPayrollRunStatus",
    "VacationRequestStatus",
    "AFPProvider",
    "BankAccountType",
    "Plan",
    "Subscription",
    "Invoice",
    "UsageRecord",
    "PlanTier",
    "SubscriptionStatus",
    "InvoiceStatus",
    "CandidateJobMatch",
    "MatchStatus",
    "VideoInterview",
    "VideoInterviewStatus",
]
