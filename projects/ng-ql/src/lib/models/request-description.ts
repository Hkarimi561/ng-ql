import type { HttpHeaders, HttpParams } from '@angular/common/http';
import type { NgQlHttpMethod } from './query-types';

/**
 * A fully resolved, inspectable description of the HTTP request a query
 * builder or resource call would perform. Obtained via
 * {@link NgQlQueryBuilder#toRequest}; never triggers a request by itself.
 */
export interface NgQlRequestDescription {
  readonly method: NgQlHttpMethod;
  /** The resolved URL, without a query string. */
  readonly url: string;
  readonly params: HttpParams;
  readonly headers: HttpHeaders;
  readonly withCredentials?: boolean;
  readonly body?: unknown;
}
