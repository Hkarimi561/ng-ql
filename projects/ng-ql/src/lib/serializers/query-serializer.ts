import type { HttpParams } from '@angular/common/http';
import type { NgQlQueryState } from '../models/query-types';

/**
 * Turns an immutable {@link NgQlQueryState} into `HttpParams`.
 *
 * Implement this to adapt ng-ql's query builder to any backend filtering
 * convention (JSON:API, OData, a bespoke REST dialect, ...). Provide a custom
 * implementation through {@link NgQlConfig#querySerializer}.
 */
export interface NgQlQuerySerializer {
  serialize(state: NgQlQueryState): HttpParams;
}
