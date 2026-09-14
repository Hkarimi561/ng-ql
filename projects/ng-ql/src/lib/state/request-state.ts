import { type DestroyRef, computed, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { NgQlCachePolicy } from '../models/cache-policy';
import type { NgQlRequestState, NgQlRequestStatus } from '../models/state';
import type { NgQlCacheService } from '../cache/ng-ql-cache.service';
import { CachedRequestRunner } from './cached-request-runner';

export interface RequestStateOptions<T> {
  readonly fetch: () => Observable<T>;
  readonly cacheKey: string;
  readonly policy: NgQlCachePolicy;
  readonly ttl: number;
  readonly tags: readonly string[];
  readonly endpoint?: string;
  readonly retryCount?: number;
  readonly retryDelay?: number;
  readonly cache: NgQlCacheService;
  readonly destroyRef: DestroyRef;
}

/** Concrete, mutable-internally implementation of {@link NgQlRequestState}. */
export class NgQlRequestStateImpl<T> implements NgQlRequestState<T> {
  private readonly _data = signal<T | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<unknown | null>(null);
  private readonly _status = signal<NgQlRequestStatus>('idle');
  private readonly runner: CachedRequestRunner<T>;

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly status = this._status.asReadonly();
  readonly hasData = computed(() => this._data() !== null);

  constructor(private readonly options: RequestStateOptions<T>) {
    this.runner = new CachedRequestRunner<T>(options.cache, options.destroyRef);
    this.execute('initial');
  }

  refresh(): void {
    this.execute('refresh');
  }

  invalidate(): void {
    this.options.cache.invalidateKey(this.options.cacheKey);
    this._data.set(null);
    this._error.set(null);
    this._status.set('idle');
    this._loading.set(false);
  }

  private execute(mode: 'initial' | 'refresh'): void {
    this._status.set('loading');
    this.runner.run({
      fetch: this.options.fetch,
      cacheKey: this.options.cacheKey,
      policy: this.options.policy,
      ttl: this.options.ttl,
      tags: this.options.tags,
      endpoint: this.options.endpoint,
      retryCount: this.options.retryCount,
      retryDelay: this.options.retryDelay,
      mode,
      callbacks: {
        onValue: (value) => {
          this._data.set(value);
          this._error.set(null);
          this._status.set('success');
        },
        onError: (error, hadFallback) => {
          this._error.set(error);
          this._status.set(hadFallback ? 'success' : 'error');
        },
        onLoadingChange: (loading) => this._loading.set(loading),
      },
    });
  }
}
