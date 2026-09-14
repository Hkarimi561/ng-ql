import type { HttpHeaders } from '@angular/common/http';
import type { NgQlPaginatedResponse } from '../models/pagination';
import type { NgQlRequestOptions } from '../models/request-options';

/** Configuration accepted by {@link NgQlResource}'s constructor. */
export interface NgQlResourceConfig<TModel, TId = string | number> {
  /** The resource endpoint, relative to the global `baseUrl` (or absolute). */
  readonly endpoint: string;

  /** Name of the model's primary key property, read by {@link NgQlResource#getId}. Defaults to `'id'`. */
  readonly primaryKey?: string;

  /** Overrides how a single-item response is decoded. Falls back to the global response adapter. */
  readonly mapItem?: (raw: unknown) => TModel | null;

  /** Overrides how a collection response is decoded. Falls back to the global response adapter. */
  readonly mapCollection?: (raw: unknown) => TModel[];

  /** Overrides how a paginated response is decoded. Falls back to the global response adapter. */
  readonly mapPaginated?: (raw: unknown) => NgQlPaginatedResponse<TModel>;

  /** Overrides how an item URL is built from the endpoint and id. Defaults to `${endpoint}/${id}`. */
  readonly buildUrl?: (endpoint: string, id?: TId) => string;

  /** Request options merged into every request made through this resource. */
  readonly requestOptions?: NgQlRequestOptions;

  /** Headers merged into every request made through this resource, above global defaults. */
  readonly headers?: HttpHeaders | Record<string, string | string[]>;

  /** Cache tags applied to every Signal-based read from this resource, for bulk invalidation. */
  readonly cacheTags?: readonly string[];
}
