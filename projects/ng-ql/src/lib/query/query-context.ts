import type { HttpHeaders } from '@angular/common/http';
import type { NgQlClient } from '../client/ng-ql-client';
import type { NgQlPaginatedResponse } from '../models/pagination';
import type { NgQlRequestOptions } from '../models/request-options';

/**
 * Everything a {@link NgQlQueryBuilder} needs from its owning
 * {@link NgQlResource}, bundled so the builder doesn't need to depend on the
 * resource class itself. Internal — not part of the public API.
 */
export interface NgQlQueryContext<TModel, TId = string | number> {
  readonly client: NgQlClient;
  readonly endpoint: string;
  readonly mapItem: (raw: unknown) => TModel | null;
  readonly mapCollection: (raw: unknown) => TModel[];
  readonly mapPaginated: (raw: unknown) => NgQlPaginatedResponse<TModel>;
  readonly buildItemUrl: (id: TId) => string;
  readonly resourceHeaders?: HttpHeaders | Record<string, string | string[]>;
  readonly resourceOptions?: NgQlRequestOptions;
  readonly cacheTags: readonly string[];
}
