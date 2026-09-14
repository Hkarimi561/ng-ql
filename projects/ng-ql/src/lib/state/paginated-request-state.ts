import { type DestroyRef, computed, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { NgQlCachePolicy } from '../models/cache-policy';
import type {
  NgQlPaginationLinks,
  NgQlPaginationMeta,
  NgQlPaginatedResponse,
} from '../models/pagination';
import type { NgQlPaginatedRequestState, NgQlRequestStatus } from '../models/state';
import type { NgQlCacheService } from '../cache/ng-ql-cache.service';
import { CachedRequestRunner } from './cached-request-runner';

export interface PaginatedRequestStateOptions<TModel> {
  readonly describe: (
    page: number,
    perPage: number,
  ) => { fetch: () => Observable<NgQlPaginatedResponse<TModel>>; cacheKey: string };
  readonly initialPage: number;
  readonly initialPerPage: number;
  readonly policy: NgQlCachePolicy;
  readonly ttl: number;
  readonly tags: readonly string[];
  readonly endpoint?: string;
  readonly cache: NgQlCacheService;
  readonly destroyRef: DestroyRef;
}

/** Concrete, mutable-internally implementation of {@link NgQlPaginatedRequestState}. */
export class NgQlPaginatedRequestStateImpl<TModel> implements NgQlPaginatedRequestState<TModel> {
  private readonly _data = signal<TModel[] | null>(null);
  private readonly _meta = signal<NgQlPaginationMeta | null>(null);
  private readonly _links = signal<NgQlPaginationLinks | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<unknown | null>(null);
  private readonly _status = signal<NgQlRequestStatus>('idle');
  private readonly runner: CachedRequestRunner<NgQlPaginatedResponse<TModel>>;

  private page: number;
  private perPage: number;

  readonly data = this._data.asReadonly();
  readonly meta = this._meta.asReadonly();
  readonly links = this._links.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly status = this._status.asReadonly();
  readonly hasData = computed(() => this._data() !== null);

  constructor(private readonly options: PaginatedRequestStateOptions<TModel>) {
    this.runner = new CachedRequestRunner<NgQlPaginatedResponse<TModel>>(
      options.cache,
      options.destroyRef,
    );
    this.page = options.initialPage;
    this.perPage = options.initialPerPage;
    this.execute('initial');
  }

  refresh(): void {
    this.execute('refresh');
  }

  invalidate(): void {
    const { cacheKey } = this.options.describe(this.page, this.perPage);
    this.options.cache.invalidateKey(cacheKey);
    this._data.set(null);
    this._meta.set(null);
    this._links.set(null);
    this._error.set(null);
    this._status.set('idle');
    this._loading.set(false);
  }

  setPage(page: number): void {
    this.page = page;
    this.execute('initial');
  }

  setPerPage(perPage: number): void {
    this.perPage = perPage;
    this.execute('initial');
  }

  private execute(mode: 'initial' | 'refresh'): void {
    const { fetch, cacheKey } = this.options.describe(this.page, this.perPage);
    this._status.set('loading');
    this.runner.run({
      fetch,
      cacheKey,
      policy: this.options.policy,
      ttl: this.options.ttl,
      tags: this.options.tags,
      endpoint: this.options.endpoint,
      mode,
      callbacks: {
        onValue: (value) => {
          this._data.set(value.data);
          this._meta.set(value.meta);
          this._links.set(value.links ?? null);
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
