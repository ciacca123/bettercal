import type { TimeInterval } from './availability/types';

interface CacheEntry {
  busy: TimeInterval[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minuti

export async function getCachedBusy(
  key: string,
  fetch: () => Promise<TimeInterval[]>
): Promise<TimeInterval[]> {
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.busy;
  }

  const busy = await fetch();
  cache.set(key, { busy, expiresAt: now + TTL_MS });
  return busy;
}

export function invalidateCalendarCache(userId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(userId)) cache.delete(key);
  }
}
