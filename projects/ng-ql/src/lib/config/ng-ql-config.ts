import type { NgQlCachePolicy } from '../models/cache-policy';
import type { NgQlRequestOptions } from '../models/request-options';
import type { NgQlResponseAdapter } from '../adapters/response-adapter';
import type { NgQlQuerySerializer } from '../serializers/query-serializer';

/** Global configuration supplied to {@link provideNgQl}. */
export interface NgQlConfig {
  /**
   * Base URL prepended to every relative resource endpoint. Joined without
   * duplicating or dropping slashes. Absolute resource endpoints (starting
   * with `http://`, `https://`, or `//`) bypass this entirely.
   */
  readonly baseUrl: string;

  /** Headers merged into every request, at the lowest precedence. */
  readonly defaultHeaders?: Record<string, string | string[]>;

  /** Default `withCredentials` for every request, unless overridden. */
  readonly withCredentials?: boolean;

  /** Default cache policy used by Signal-based requests that don't specify one. */
  readonly defaultCachePolicy?: NgQlCachePolicy;

  /** Default cache TTL (ms) used by Signal-based requests that don't specify one. */
  readonly defaultCacheTtl?: number;

  /** Custom query serializer. Defaults to {@link DefaultNgQlQuerySerializer}. */
  readonly querySerializer?: NgQlQuerySerializer;

  /** Custom response adapter. Defaults to {@link DefaultNgQlResponseAdapter}. */
  readonly responseAdapter?: NgQlResponseAdapter;

  /** Default request options merged into every request, above `defaultHeaders`/`withCredentials`. */
  readonly defaultRequestOptions?: NgQlRequestOptions;
}

/** Fully-resolved configuration, after defaults have been applied. */
export interface NgQlResolvedConfig extends NgQlConfig {
  readonly defaultCachePolicy: NgQlCachePolicy;
  readonly defaultCacheTtl: number;
  readonly querySerializer: NgQlQuerySerializer;
  readonly responseAdapter: NgQlResponseAdapter;
}
