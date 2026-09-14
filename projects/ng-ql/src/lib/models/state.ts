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
}

/** Read-only, signal-backed state for a paginated collection request. */
export interface NgQlPaginatedRequestState<T> extends NgQlRequestState<T[]> {
  readonly meta: Signal<NgQlPaginationMeta | null>;
  readonly links: Signal<NgQlPaginationLinks | null>;

  /** Navigates to the given page, re-executing the request. */
  setPage(page: number): void;

  /** Changes the page size, re-executing the request. */
  setPerPage(perPage: number): void;
}
