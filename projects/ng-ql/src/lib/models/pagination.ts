/** Normalized pagination metadata, independent of the backend's naming convention. */
export interface NgQlPaginationMeta {
  readonly currentPage: number;
  readonly perPage: number;
  readonly total: number;
  readonly lastPage?: number;
}

/** Normalized pagination links, independent of the backend's naming convention. */
export interface NgQlPaginationLinks {
  readonly first?: string | null;
  readonly last?: string | null;
  readonly prev?: string | null;
  readonly next?: string | null;
}

/** A normalized paginated collection response. */
export interface NgQlPaginatedResponse<TModel> {
  readonly data: TModel[];
  readonly meta: NgQlPaginationMeta;
  readonly links?: NgQlPaginationLinks;
  /** The untouched, adapter-received payload, for advanced/custom consumption. */
  readonly raw?: unknown;
}
