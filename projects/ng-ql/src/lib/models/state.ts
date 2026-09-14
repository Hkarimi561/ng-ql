import type { Observable } from 'rxjs';
import type { Signal } from '@angular/core';
import type { NgQlPaginationLinks, NgQlPaginationMeta } from './pagination';

/** Lifecycle status of a signal-backed request. */
export type NgQlRequestStatus = 'idle' | 'loading' | 'success' | 'error';

/** Read-only, signal-backed state for a single request. */
export interface NgQlRequestState<T> {
  readonly data: Signal<T | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<unknown | null>;
  readonly status: Signal<NgQlRequestStatus>;
  readonly hasData: Signal<boolean>;

  /** Re-executes the request, bypassing `cache-first` freshness (still writes the cache). */
  refresh(): void;

  /** Drops any cached value for this request and resets state to `idle`. */
  invalidate(): void;

  /**
   * Applies `updater` to the current data immediately (optimistic UI), then
   * subscribes to `commit()`. If `commit()` errors, the previous value and
   * status are restored and the error is surfaced via {@link error}; on
   * success, the optimistic value is left in place. Does not touch the
   * cache — a normal mutation's own cache invalidation (see
   * `NgQlResource`'s CRUD methods) governs what a later `refresh()` sees.
   *
   * ```ts
   * postsState.mutateOptimistically(
   *   (posts) => (posts ?? []).filter((p) => p.id !== id),
   *   () => this.posts.destroy(id),
   * );
   * ```
   */
  mutateOptimistically<R = unknown>(
    updater: (current: T | null) => T,
    commit: () => Observable<R>,
  ): void;
}

/** Read-only, signal-backed state for a paginated collection request. */
export interface NgQlPaginatedRequestState<T> extends NgQlRequestState<T[]> {
  readonly meta: Signal<NgQlPaginationMeta | null>;
  readonly links: Signal<NgQlPaginationLinks | null>;
  /** `true` while a {@link loadMore} fetch is in flight. Distinct from {@link NgQlRequestState.loading}. */
  readonly loadingMore: Signal<boolean>;
  /** Whether another page is known to exist after the currently-loaded one. */
  readonly hasMore: Signal<boolean>;

  /** Navigates to the given page, re-executing the request and *replacing* `data`. */
  setPage(page: number): void;

  /** Changes the page size, re-executing the request and *replacing* `data`. */
  setPerPage(perPage: number): void;

  /**
   * Fetches the next page and *appends* its items to the existing `data`
   * array — for infinite-scroll / "load more" UIs. A no-op while a fetch is
   * already in flight, or once {@link hasMore} is `false`.
   */
  loadMore(): void;
}
