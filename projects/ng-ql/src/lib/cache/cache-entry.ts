/** Internal cache-entry shape. Not part of the public API. */
export interface NgQlCacheEntry<T = unknown> {
  readonly value: T;
  readonly createdAt: number;
  readonly ttl: number;
  readonly tags: readonly string[];
  readonly endpoint?: string;
}

export function isEntryExpired(entry: NgQlCacheEntry, now: number): boolean {
  if (entry.ttl <= 0) return false;
  return now - entry.createdAt > entry.ttl;
}
