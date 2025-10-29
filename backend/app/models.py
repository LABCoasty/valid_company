from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl


class TrustBreakdown(BaseModel):
    label: str
    score: float = Field(ge=0.0, le=100.0)
    weight: float = Field(ge=0.0, le=1.0)
    notes: Optional[str] = None


class TrustScoreResponse(BaseModel):
    companyName: str
    score: Optional[float]
    status: str
    message: str
    breakdown: List[TrustBreakdown]
    lastUpdated: datetime


class TrustScoreRequest(BaseModel):
    companyName: str
    jobTitle: Optional[str] = None
    jobUrl: Optional[HttpUrl] = None
    jobLocation: Optional[str] = None
    timestamp: datetime


class ApplicationLog(BaseModel):
    companyName: str
    jobTitle: str
    jobUrl: HttpUrl
    jobLocation: Optional[str] = None
    submittedAt: datetime
    aliasEmail: Optional[str] = None
    status: str
    notes: Optional[str] = None


class ApplicationSyncRequest(BaseModel):
    entries: List[ApplicationLog]


class ApplicationSyncResponse(BaseModel):
    syncedIds: List[str]
    failedIds: List[str] = Field(default_factory=list)
