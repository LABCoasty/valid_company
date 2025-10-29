import { DEFAULT_RESUME, DEFAULT_SETTINGS } from './defaults';
import { AliasRecord, ApplicationLog, Resume, Settings, TrustScore } from './types';

const SETTINGS_KEY = 'settings';
const RESUME_KEY = 'resume';
const QUEUE_KEY = 'applicationQueue';
const ALIAS_MAP_KEY = 'aliasMap';
const TRUST_CACHE_KEY = 'trustCache';

type AliasMap = Record<string, AliasRecord>;
type TrustCache = Record<string, TrustScore>;

type StorageArea = 'sync' | 'local';

function withStorage(area: StorageArea, method: 'get' | 'set' | 'remove' | 'clear', payload?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const target = chrome.storage[area];
    const callback = () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(undefined);
      }
    };
    try {
      if (method === 'get') {
        target.get(payload, (value: any) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(value);
          }
        });
        return;
      }

      if (method === 'set') {
        target.set(payload, callback);
        return;
      }

      if (method === 'remove') {
        target.remove(payload, callback);
        return;
      }

      target.clear(callback);
    } catch (error) {
      reject(error);
    }
  });
}

export async function getSettings(): Promise<Settings> {
  const response = (await withStorage('sync', 'get', SETTINGS_KEY)) as Record<string, Settings>;
  return response?.[SETTINGS_KEY] ?? { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Settings): Promise<void> {
  await withStorage('sync', 'set', { [SETTINGS_KEY]: settings });
}

export async function getResume(): Promise<Resume> {
  const response = (await withStorage('local', 'get', RESUME_KEY)) as Record<string, Resume>;
  return response?.[RESUME_KEY] ?? { ...DEFAULT_RESUME };
}

export async function setResume(resume: Resume): Promise<void> {
  await withStorage('local', 'set', { [RESUME_KEY]: resume });
}

export async function getQueue(): Promise<ApplicationLog[]> {
  const response = (await withStorage('local', 'get', QUEUE_KEY)) as Record<string, ApplicationLog[]>;
  return response?.[QUEUE_KEY] ?? [];
}

export async function setQueue(queue: ApplicationLog[]): Promise<void> {
  await withStorage('local', 'set', { [QUEUE_KEY]: queue });
}

export async function getAliasMap(): Promise<AliasMap> {
  const response = (await withStorage('local', 'get', ALIAS_MAP_KEY)) as Record<string, AliasMap>;
  return response?.[ALIAS_MAP_KEY] ?? {};
}

export async function setAliasMap(map: AliasMap): Promise<void> {
  await withStorage('local', 'set', { [ALIAS_MAP_KEY]: map });
}

export async function getTrustCache(): Promise<TrustCache> {
  const response = (await withStorage('local', 'get', TRUST_CACHE_KEY)) as Record<string, TrustCache>;
  return response?.[TRUST_CACHE_KEY] ?? {};
}

export async function setTrustCache(cache: TrustCache): Promise<void> {
  await withStorage('local', 'set', { [TRUST_CACHE_KEY]: cache });
}

export function upsertTrustCacheEntry(cache: TrustCache, score: TrustScore): TrustCache {
  return { ...cache, [score.companyName.toLowerCase()]: score };
}

export function getTrustFromCache(cache: TrustCache, companyName: string): TrustScore | undefined {
  return cache[companyName.toLowerCase()];
}

export function upsertAlias(map: AliasMap, companyName: string, alias: AliasRecord): AliasMap {
  return { ...map, [companyName.toLowerCase()]: alias };
}

export function getAlias(map: AliasMap, companyName: string): AliasRecord | undefined {
  return map[companyName.toLowerCase()];
}

export function removeAlias(map: AliasMap, companyName: string): AliasMap {
  const updated = { ...map };
  delete updated[companyName.toLowerCase()];
  return updated;
}

export function appendQueue(queue: ApplicationLog[], entry: ApplicationLog): ApplicationLog[] {
  return [...queue, entry];
}

export function updateQueueEntry(queue: ApplicationLog[], predicate: (entry: ApplicationLog) => boolean, updater: (entry: ApplicationLog) => ApplicationLog): ApplicationLog[] {
  return queue.map((entry) => (predicate(entry) ? updater(entry) : entry));
}

export function removeQueueEntries(queue: ApplicationLog[], predicate: (entry: ApplicationLog) => boolean): ApplicationLog[] {
  return queue.filter((entry) => !predicate(entry));
}
