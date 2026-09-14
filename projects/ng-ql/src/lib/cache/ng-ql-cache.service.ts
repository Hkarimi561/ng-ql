import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, finalize, share } from 'rxjs';
import { isEntryExpired, type NgQlCacheEntry } from './cache-entry';

/**
 * Injectable, instance-scoped query cache used by ng-ql's Signal-based
 * request APIs. Never a global/static store: each injector (root, or a
 * component/route that re-provides it) gets its own isolated instance, so
 * cache entries never leak across unrelated resources unless they happen to
 * share the same key.
 *
 * Only idempotent `GET` requests are ever cached; mutations are never stored
 * here, and successful mutations invalidate related entries instead.
 */
@Injectable({ providedIn: 'root' })
export class NgQlCacheService {
  private readonly entries = new Map<string, NgQlCacheEntry>();
  private readonly inFlight = new Map<string, Observable<unknown>>();

  /** Returns the cached value for `key` if present and not expired. */
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || isEntryExpired(entry, Date.now())) return undefined;
    return entry.value as T;
  }

  /** Returns the cached value for `key` regardless of expiry, plus whether it is expired. */
  peek<T>(key: string): { value: T; expired: boolean } | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    return { value: entry.value as T, expired: isEntryExpired(entry, Date.now()) };
  }

  /** Stores `value` under `key`, associating it with `tags` and an optional owning `endpoint`. */
  set<T>(
    key: string,
    value: T,
    options: { ttl: number; tags?: readonly string[]; endpoint?: string },
  ): void {
    this.entries.set(key, {
      value,
      createdAt: Date.now(),
      ttl: options.ttl,
      tags: options.tags ?? [],
      endpoint: options.endpoint,
    });
  }

  /** Removes a single cache entry. */
  invalidateKey(key: string): void {
    this.entries.delete(key);
  }

  /** Removes every cache entry carrying the given tag. */
  invalidateTag(tag: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.tags.includes(tag)) this.entries.delete(key);
    }
  }

  /** Removes every cache entry owned by the given resource endpoint. */
  invalidateEndpoint(endpoint: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.endpoint === endpoint) this.entries.delete(key);
    }
  }

  /** Clears the entire cache. */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Deduplicates concurrent, identical in-flight requests: the first caller
   * for a given `key` triggers `source()`; subsequent callers before it
   * settles share the same underlying Observable instead of issuing a new
   * HTTP request.
   */
  dedupe<T>(key: string, source: () => Observable<T>): Observable<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Observable<T>;

    const shared = source().pipe(
      finalize(() => this.inFlight.delete(key)),
      share({
        connector: () => new ReplaySubject(1),
        resetOnRefCountZero: true,
        resetOnComplete: true,
        resetOnError: true,
      }),
    );
    this.inFlight.set(key, shared);
    return shared;
  }
}
