from __future__ import annotations

import asyncio
from typing import Dict, Optional

import httpx


class ReviewSignalClient:
    """Aggregates employer review and job posting activity signals."""

    def __init__(self, *, timeout: float = 8.0) -> None:
        self._client = httpx.AsyncClient(timeout=timeout)

    async def close(self) -> None:
        await self._client.aclose()

    async def fetch_signals(self, company_name: str) -> Dict[str, float]:
        glassdoor = self._fetch_glassdoor(company_name)
        indeed = self._fetch_indeed(company_name)

        results = await asyncio.gather(glassdoor, indeed, return_exceptions=True)
        signals: Dict[str, float] = {}
        for result in results:
            if isinstance(result, dict):
                signals.update(result)
        return signals

    async def _fetch_glassdoor(self, company_name: str) -> Optional[Dict[str, float]]:
        url = 'https://www.glassdoor.com/profile/ajax/employerOverview.htm'
        params = {'employer': company_name}
        try:
            response = await self._client.get(url, params=params, headers={'User-Agent': 'CompanyValidator/1.0'})
            response.raise_for_status()
        except httpx.HTTPError:
            return None

        data = response.json()
        return {
            'glassdoor_rating': float(data.get('rating') or 0.0),
            'glassdoor_reviews': float(data.get('reviewsCount') or 0)
        }

    async def _fetch_indeed(self, company_name: str) -> Optional[Dict[str, float]]:
        url = 'https://www.indeed.com/cmp/{}/about'.format(company_name.replace(' ', '-'))
        try:
            response = await self._client.get(url, headers={'User-Agent': 'CompanyValidator/1.0'})
            response.raise_for_status()
        except httpx.HTTPError:
            return None

        # placeholder parser - actual implementation would parse HTML for rating
        return {
            'indeed_rating': 3.8,
            'indeed_reviews': 120.0
        }
