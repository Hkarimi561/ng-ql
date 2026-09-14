import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { NGQL_CONFIG } from '../config/ng-ql.tokens';
import type { NgQlResolvedConfig } from '../config/ng-ql-config';
import { NgQlCacheService } from '../cache/ng-ql-cache.service';
import type { NgQlHttpMethod } from '../models/query-types';
import { joinUrl } from './url-join';
import { mergeHeaders, type HeaderInput } from './merge-headers';

/** A fully-resolved, ready-to-send HTTP call. Internal — not part of the public API. */
export interface NgQlPreparedRequest {
  readonly method: NgQlHttpMethod;
  readonly url: string;
  readonly params?: HttpParams;
  readonly headers?: HttpHeaders;
  readonly withCredentials?: boolean;
  readonly context?: HttpContext;
  readonly body?: unknown;
}

/**
 * The low-level Angular `HttpClient`-backed execution engine shared by every
 * {@link NgQlResource} and {@link NgQlQueryBuilder}. Resolves URLs against
 * the configured base URL, merges headers in precedence order, and executes
 * requests. Never triggers a request except when one of its methods is
 * explicitly called.
 */
@Injectable({ providedIn: 'root' })
export class NgQlClient {
  private readonly http = inject(HttpClient);
  private readonly cacheService = inject(NgQlCacheService);

  /** The resolved configuration this client was created with. */
  readonly config: NgQlResolvedConfig = inject(NGQL_CONFIG);

  /** The Signal-based request cache shared by every resource using this client. */
  get cache(): NgQlCacheService {
    return this.cacheService;
  }

  /** Resolves a (possibly relative) resource endpoint against the configured base URL. */
  resolveUrl(endpoint: string): string {
    return joinUrl(this.config.baseUrl, endpoint);
  }

  /**
   * Merges header sources in ascending precedence: global defaults, resource
   * defaults, builder headers, then per-request headers.
   */
  mergeHeaders(
    resourceDefaults?: HeaderInput,
    builderHeaders?: HeaderInput,
    requestHeaders?: HeaderInput,
  ): HttpHeaders {
    return mergeHeaders(
      this.config.defaultHeaders,
      resourceDefaults,
      builderHeaders,
      requestHeaders,
    );
  }

  /** Executes a prepared request. Never adapts or caches the response. */
  execute<T>(request: NgQlPreparedRequest): Observable<T> {
    return this.http.request<T>(request.method, request.url, {
      params: request.params,
      headers: request.headers,
      withCredentials: request.withCredentials ?? this.config.withCredentials,
      context: request.context,
      body: request.body,
      observe: 'body',
    }) as Observable<T>;
  }

  /** Invalidates every cache entry owned by `endpoint`, plus any of the given `tags`. */
  invalidateAfterMutation(endpoint: string, tags?: readonly string[]): void {
    this.cacheService.invalidateEndpoint(endpoint);
    for (const tag of tags ?? []) {
      this.cacheService.invalidateTag(tag);
    }
  }
}
