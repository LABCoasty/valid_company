from __future__ import annotations

import asyncio
from datetime import datetime
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    ApplicationLog,
    ApplicationSyncRequest,
    ApplicationSyncResponse,
    TrustBreakdown,
    TrustScoreRequest,
    TrustScoreResponse,
)
from .services.registries import BusinessRegistryClient
from .services.reviews import ReviewSignalClient
from .services.scams import ScamDetector

app = FastAPI(title="Company Validator API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
)

registry_client = BusinessRegistryClient()
review_client = ReviewSignalClient()
scam_detector = ScamDetector()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await asyncio.gather(registry_client.close(), review_client.close(), return_exceptions=True)


@app.post("/api/v1/trust/scores", response_model=TrustScoreResponse)
async def score_company(payload: TrustScoreRequest) -> TrustScoreResponse:
    registry_task = asyncio.create_task(registry_client.lookup(payload.companyName))
    review_task = asyncio.create_task(review_client.fetch_signals(payload.companyName))

    registry_result, review_result = await asyncio.gather(registry_task, review_task)

    breakdown: List[TrustBreakdown] = []

    if registry_result:
        breakdown.append(
            TrustBreakdown(
                label="Business registration",
                score=95.0,
                weight=0.35,
                notes=f"Found entity in {registry_result.get('source')}"
            )
        )
    else:
        breakdown.append(
            TrustBreakdown(
                label="Business registration",
                score=40.0,
                weight=0.35,
                notes="Entity not located in registry search"
            )
        )

    if review_result:
        rating = review_result.get('glassdoor_rating', 0.0)
        breakdown.append(
            TrustBreakdown(
                label="Employee reviews",
                score=min(max(rating * 20, 30.0), 100.0),
                weight=0.25,
                notes=f"Glassdoor rating {rating:.1f}"
            )
        )
        openings = review_result.get('indeed_reviews', 0.0)
        breakdown.append(
            TrustBreakdown(
                label="Job activity",
                score=min(80.0 + min(openings / 50.0, 20.0), 100.0),
                weight=0.15,
                notes=f"Approx. {openings:.0f} recent reviews"
            )
        )
    else:
        breakdown.append(
            TrustBreakdown(
                label="Public sentiment",
                score=55.0,
                weight=0.25,
                notes="Unable to gather third-party reviews"
            )
        )

    job_text = f"{payload.jobTitle or ''} {payload.jobLocation or ''}"
    scam_score = scam_detector.fallback_score(job_text)
    breakdown.append(
        TrustBreakdown(
            label="Listing authenticity",
            score=100.0 - (scam_score * 100.0),
            weight=0.25,
            notes="Heuristic scam detector"
        )
    )

    aggregate = sum(item.score * item.weight for item in breakdown)
    status = 'ok' if aggregate >= 70 else 'warning' if aggregate >= 50 else 'high-risk'

    return TrustScoreResponse(
        companyName=payload.companyName,
        score=round(aggregate, 2),
        status=status,
        message="Composite trust score generated from registry, review, and scam heuristics.",
        breakdown=breakdown,
        lastUpdated=datetime.utcnow()
    )


@app.post("/api/v1/applications", response_model=ApplicationSyncResponse)
async def sync_applications(payload: ApplicationSyncRequest) -> ApplicationSyncResponse:
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries provided")

    # In a production implementation this would use Google Sheets API with OAuth tokens.
    # Here we emulate success by returning job URLs as synced identifiers.
    synced_ids = [entry.jobUrl for entry in payload.entries]
    return ApplicationSyncResponse(syncedIds=synced_ids, failedIds=[])
