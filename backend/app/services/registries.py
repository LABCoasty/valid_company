from __future__ import annotations

import asyncio
from typing import Dict, Optional

import httpx


class BusinessRegistryClient:
    """Fetches entity information from state and global business registries."""

    def __init__(self, *, timeout: float = 8.0) -> None:
        self._timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    async def close(self) -> None:
        await self._client.aclose()

    async def lookup(self, company_name: str) -> Optional[Dict[str, str]]:
        providers = [
            self._lookup_opencorporates(company_name),
            self._lookup_ca_state(company_name)
        ]

        for task in asyncio.as_completed(providers):
            result = await task
            if result:
                return result
        return None

    async def _lookup_opencorporates(self, company_name: str) -> Optional[Dict[str, str]]:
        url = 'https://api.opencorporates.com/v0.4/companies/search'
        params = {'q': company_name, 'order': 'score'}
        try:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
        except httpx.HTTPError:
            return None

        data = response.json()
        companies = data.get('results', {}).get('companies') or []
        if not companies:
            return None

        top = companies[0].get('company') or {}
        return {
            'jurisdiction': top.get('jurisdiction_code', ''),
            'company_number': top.get('company_number', ''),
            'incorporation_date': top.get('incorporation_date', ''),
            'source': 'opencorporates'
        }

    async def _lookup_ca_state(self, company_name: str) -> Optional[Dict[str, str]]:
        url = 'https://businesssearch.sos.ca.gov/api/advanced'
        payload = {
            'EntityId': None,
            'SearchCriteria': company_name,
            'Status': 'ACTIVE'
        }
        try:
            response = await self._client.post(url, json=payload)
            response.raise_for_status()
        except httpx.HTTPError:
            return None

        data = response.json()
        entities = data.get('businessEntities') or []
        if not entities:
            return None

        entity = entities[0]
        return {
            'jurisdiction': 'us_ca',
            'company_number': entity.get('entityNumber', ''),
            'incorporation_date': entity.get('registrationDate', ''),
            'source': 'ca_sos'
        }
