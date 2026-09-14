import type { NgQlPaginatedResponse } from '../models/pagination';

/**
 * Normalizes raw HTTP response bodies into the shapes ng-ql works with.
 * Provide a custom implementation through {@link NgQlConfig#responseAdapter}
 * to support a bespoke API envelope.
 */
export interface NgQlResponseAdapter {
  /** Extracts an array of items from a raw collection response. */
  adaptCollection<TModel>(raw: unknown): TModel[];

  /** Extracts a single item from a raw item response, or `null` when absent/empty. */
  adaptItem<TModel>(raw: unknown): TModel | null;

  /** Extracts a normalized paginated response from a raw paginated response. */
  adaptPaginated<TModel>(raw: unknown): NgQlPaginatedResponse<TModel>;
}
