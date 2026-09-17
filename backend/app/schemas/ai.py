from typing import Literal

from pydantic import BaseModel, Field


class AssistantQuery(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    site_id: str | None = None
    project_id: str | None = None


class AssistantResponse(BaseModel):
    answer: str
    provider: str
    model: str
    context: dict
    sources: list[str] = []


class ReportGenerateRequest(BaseModel):
    site_id: str | None = None
    project_id: str | None = None
    report_type: Literal["ai_summary", "funder_report", "agent_alert"] = "ai_summary"


class ReportOut(BaseModel):
    id: str
    project_id: str | None
    site_id: str | None
    report_type: str
    content: str
    generated_at: str
    generated_by: str


class NotificationOut(BaseModel):
    id: str
    site_id: str
    message: str
    severity: str
    created_at: str
    read_at: str | None


class MonitoringRunOut(BaseModel):
    evaluated: int
    alerts_created: int
    reports_created: int
    at_risk: int
    watch: int
    healthy: int
