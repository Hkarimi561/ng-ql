import { HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import type { QueryValue } from './query-types';
import type { NgQlCachePolicy } from './cache-policy';

/** Per-request options accepted by every Observable-returning ng-ql method. */
export interface NgQlRequestOptions {
  readonly headers?: HttpHeaders | Record<string, string | string[]>;
  readonly params?:
    HttpParams | Record<string, QueryValue | readonly QueryValue[] | null | undefined>;
  readonly withCredentials?: boolean;
  readonly context?: HttpContext;
  readonly observe?: 'body';
}

/** Per-request options accepted by every Signal-returning ng-ql method. */
export interface NgQlSignalRequestOptions extends NgQlRequestOptions {
  /** Cache policy for this request. Defaults to the client's configured default. */
  readonly cache?: NgQlCachePolicy;
  /** Time-to-live, in milliseconds, for cache entries written by this request. */
  readonly cacheTtl?: number;
  /** Explicit cache key override. Defaults to a deterministic key derived from the request. */
  readonly cacheKey?: string;
  /** Tags used for bulk cache invalidation. */
  readonly cacheTags?: readonly string[];
  /**
   * Max retry attempts on failure, before falling back to cache (for
   * `network-first` / `stale-while-revalidate`) or erroring. Defaults to `0`
   * (no retries). Each retry waits `retryDelay * 2^(attempt - 1)` — i.e.
   * exponential backoff.
   */
  readonly retry?: number;
  /** Base delay, in milliseconds, between retries. Defaults to `300`. */
  readonly retryDelay?: number;
}
