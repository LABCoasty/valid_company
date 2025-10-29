import {
  BackgroundRequest,
  BackgroundResponse,
  AliasRecord,
  ApplicationLog,
  AutofillPayload,
  AutofillRequest,
  Settings,
  TrustScore,
  TrustScoreRequest
} from './shared/types';
import { DEFAULT_SETTINGS } from './shared/defaults';
import {
  appendQueue,
  getAliasMap,
  getQueue,
  getResume,
  getSettings,
  getTrustCache,
  removeAlias,
  setAliasMap,
  setQueue,
  setTrustCache,
  setSettings
} from './shared/storage';

const TRUST_ENDPOINT = 'trust/scores';
const APPLICATIONS_ENDPOINT = 'applications';

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await setSettings({ ...DEFAULT_SETTINGS, ...settings });

  await getResume();
  await getQueue();
  await getAliasMap();
  await getTrustCache();
});

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  (async () => {
    let response: BackgroundResponse<any>;
    try {
      switch (message.type) {
        case 'FETCH_TRUST_SCORE':
          response = await handleTrustScoreRequest(message.payload);
          break;
        case 'REQUEST_AUTOFILL':
          response = await handleAutofill(message.payload);
          break;
        case 'LOG_APPLICATION':
          response = await handleLogApplication(message.payload);
          break;
        case 'FLUSH_QUEUE':
          response = await handleFlushQueue();
          break;
        case 'GET_QUEUE_STATUS':
          response = await handleQueueStatus();
          break;
        case 'RESET_ALIAS':
          response = await handleResetAlias(message.payload.companyName);
          break;
        default:
          response = { ok: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('[Company Validator] background error', error);
      response = { ok: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }

    sendResponse(response);
  })();

  return true;
});

async function handleTrustScoreRequest(request: TrustScoreRequest): Promise<BackgroundResponse<TrustScore>> {
  const cache = await getTrustCache();
  const cached = request.companyName ? cache[request.companyName.toLowerCase()] : undefined;

  if (cached && cached.lastUpdated) {
    const updatedAt = Date.parse(cached.lastUpdated);
    const now = Date.now();
    const age = now - updatedAt;
    const maxAge = 1000 * 60 * 60 * 24; // 1 day
    if (!Number.isNaN(age) && age < maxAge) {
      return { ok: true, data: cached };
    }
  }

  const settings = await getSettings();
  const endpoint = new URL(TRUST_ENDPOINT, settings.apiBaseUrl);
  const payload = {
    companyName: request.companyName,
    jobTitle: request.jobTitle,
    jobUrl: request.jobUrl,
    jobLocation: request.jobLocation,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as Partial<TrustScore>;
    const normalized = normalizeTrustScore(data, request.companyName);

    cache[normalized.companyName.toLowerCase()] = normalized;
    await setTrustCache(cache);

    return { ok: true, data: normalized };
  } catch (error) {
    console.warn('[Company Validator] trust score failed', error);
    const fallback = normalizeTrustScore(null, request.companyName);
    return { ok: true, data: fallback };
  }
}

function normalizeTrustScore(raw: Partial<TrustScore> | null, companyName: string): TrustScore {
  const now = new Date().toISOString();
  if (!raw) {
    return {
      companyName,
      score: null,
      status: 'unavailable',
      message: 'Trust score unavailable. Try again later.',
      breakdown: [],
      lastUpdated: now
    };
  }

  const status = raw.status ?? (typeof raw.score === 'number' ? 'ok' : 'unverified');

  return {
    companyName: raw.companyName ?? companyName,
    score: typeof raw.score === 'number' ? raw.score : null,
    status,
    message: raw.message ?? '',
    breakdown: Array.isArray(raw.breakdown) ? raw.breakdown : [],
    lastUpdated: raw.lastUpdated ?? now
  };
}

async function handleAutofill(request: AutofillRequest): Promise<BackgroundResponse<AutofillPayload>> {
  const resume = await getResume();
  const settings = await getSettings();
  const aliasMap = await getAliasMap();

  const companyName = request.companyName.trim();
  const normalizedCompany = companyName || 'unknown-company';
  const key = normalizedCompany.toLowerCase();
  const existingAlias = aliasMap[key];
  const alias = existingAlias
    ? { ...existingAlias, lastUsedAt: new Date().toISOString() }
    : createAliasRecord(normalizedCompany, settings);

  aliasMap[key] = alias;
  await setAliasMap(aliasMap);

  const payload: AutofillPayload = {
    resume,
    aliasEmail: alias.alias
  };

  return { ok: true, data: payload };
}

function createAliasRecord(companyName: string, settings: Settings): AliasRecord {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const unique = Math.random().toString(36).slice(2, 8);
  const alias = `${slug || 'job'}-${unique}@${settings.aliasDomain}`;
  const now = new Date().toISOString();
  return { alias, createdAt: now, lastUsedAt: now };
}

async function handleLogApplication(entry: ApplicationLog): Promise<BackgroundResponse<ApplicationLog[]>> {
  const queue = await getQueue();
  const updatedQueue = appendQueue(queue, { ...entry, status: 'queued' });
  await setQueue(updatedQueue);
  return { ok: true, data: updatedQueue };
}

async function handleQueueStatus(): Promise<BackgroundResponse<ApplicationLog[]>> {
  const queue = await getQueue();
  return { ok: true, data: queue };
}

async function handleResetAlias(companyName: string): Promise<BackgroundResponse<AliasRecord | null>> {
  if (!companyName) {
    return { ok: false, error: 'Company name required' };
  }

  const aliasMap = await getAliasMap();
  const updated = removeAlias(aliasMap, companyName);
  await setAliasMap(updated);
  return { ok: true, data: null };
}

async function handleFlushQueue(): Promise<BackgroundResponse<ApplicationLog[]>> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { ok: true, data: [] };
  }

  const settings = await getSettings();
  const endpoint = new URL(APPLICATIONS_ENDPOINT, settings.apiBaseUrl);
  const unsynced = queue.filter((entry) => entry.status !== 'synced');

  if (unsynced.length === 0) {
    return { ok: true, data: queue };
  }

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: unsynced })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { syncedIds?: string[] };
    const syncedIds = new Set(payload.syncedIds ?? unsynced.map((entry) => entry.jobUrl));

    const updatedQueue = queue.map((entry) => {
      if (syncedIds.has(entry.jobUrl)) {
        return { ...entry, status: 'synced' };
      }
      return entry;
    });

    await setQueue(updatedQueue);
    return { ok: true, data: updatedQueue };
  } catch (error) {
    console.warn('[Company Validator] failed to sync queue', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to sync queue' };
  }
}
