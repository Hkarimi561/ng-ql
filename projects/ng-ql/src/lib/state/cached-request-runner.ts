import type { DestroyRef } from '@angular/core';
import { type Observable, retry, timer } from 'rxjs';
import type { NgQlCachePolicy } from '../models/cache-policy';
import type { NgQlCacheService } from '../cache/ng-ql-cache.service';

/**
 * Wraps a fetch with retry-with-exponential-backoff: attempt 1 fails → wait
 * `baseDelayMs`, attempt 2 fails → wait `baseDelayMs * 2`, and so on. A
 * `count` of 0 (the default) disables retrying entirely, preserving prior
 * behavior.
 */
function withRetry<T>(source: Observable<T>, count: number, baseDelayMs: number): Observable<T> {
  if (count <= 0) return source;
  return source.pipe(
    retry({
      count,
      delay: (_error, attempt) => timer(baseDelayMs * 2 ** (attempt - 1)),
    }),
  );
}

export interface RunnerCallbacks<T> {
  /** A value became available, from cache or network. */
  onValue(value: T): void;
  /** The network request failed. `hadFallback` is true if stale/cached data was already applied. */
  onError(error: unknown, hadFallback: boolean): void;
  onLoadingChange(loading: boolean): void;
}

export interface RunOptions<T> {
  readonly fetch: () => Observable<T>;
  readonly cacheKey: string;
  readonly policy: NgQlCachePolicy;
  readonly ttl: number;
  readonly tags: readonly string[];
  readonly endpoint?: string;
  /** `refresh` always bypasses the `cache-first` shortcut and hits the network. */
  readonly mode: 'initial' | 'refresh';
  /** Max retry attempts on failure, before falling back to cache (if any) or erroring. Defaults to 0. */
  readonly retryCount?: number;
  /** Base delay (ms) between retries, doubled on each subsequent attempt. Defaults to 300. */
  readonly retryDelay?: number;
  readonly callbacks: RunnerCallbacks<T>;
}

/**
 * Shared orchestration for cache-policy-aware Signal requests: reading and
 * writing {@link NgQlCacheService}, deduplicating concurrent in-flight
 * fetches, and applying `no-store` / `cache-first` / `network-first` /
 * `stale-while-revalidate` semantics. Used by both the single-value and
 * paginated Signal request state implementations.
 */
export class CachedRequestRunner<T> {
  constructor(
    private readonly cache: NgQlCacheService,
    private readonly destroyRef: DestroyRef,
  ) {}

  run(options: RunOptions<T>): void {
    const { policy, cacheKey, mode } = options;
    const cached = this.cache.peek<T>(cacheKey);

    if (policy === 'cache-first' && mode === 'initial' && cached && !cached.expired) {
      options.callbacks.onValue(cached.value);
      return;
    }

    if (policy === 'stale-while-revalidate' && cached) {
      options.callbacks.onValue(cached.value);
    }

    const hadFallback =
      (policy === 'stale-while-revalidate' && !!cached) || (policy === 'network-first' && !!cached);

    options.callbacks.onLoadingChange(true);
    const fetchWithRetry = () =>
      withRetry(options.fetch(), options.retryCount ?? 0, options.retryDelay ?? 300);
    // Deduplication applies regardless of policy: it only avoids issuing a
    // second concurrent HTTP call, independent of whether the *result* cache
    // (governed by `policy`) is read from or written to. Retrying happens
    // inside the deduped source, so concurrent callers share one retry
    // sequence instead of each retrying independently.
    const network = this.cache.dedupe(cacheKey, fetchWithRetry);

    const subscription = network.subscribe({
      next: (value) => {
        if (policy !== 'no-store') {
          this.cache.set(cacheKey, value, {
            ttl: options.ttl,
            tags: options.tags,
            endpoint: options.endpoint,
          });
        }
        options.callbacks.onValue(value);
        options.callbacks.onLoadingChange(false);
      },
      error: (error: unknown) => {
        if (hadFallback && cached) {
          // network-first (or a failed SWR revalidation) falls back to the stale cached value.
          options.callbacks.onValue(cached.value);
          options.callbacks.onError(error, true);
        } else {
          options.callbacks.onError(error, false);
        }
        options.callbacks.onLoadingChange(false);
      },
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
