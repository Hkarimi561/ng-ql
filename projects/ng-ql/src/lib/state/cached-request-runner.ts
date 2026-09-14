import type { DestroyRef } from '@angular/core';
import type { Observable } from 'rxjs';
import type { NgQlCachePolicy } from '../models/cache-policy';
import type { NgQlCacheService } from '../cache/ng-ql-cache.service';

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
    // Deduplication applies regardless of policy: it only avoids issuing a
    // second concurrent HTTP call, independent of whether the *result* cache
    // (governed by `policy`) is read from or written to.
    const network = this.cache.dedupe(cacheKey, options.fetch);

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
