import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { NgQlClient } from '../client/ng-ql-client';
import { mergeParams } from '../client/merge-params';
import { NgQlParamCodec } from '../serializers/ng-ql-param-codec';
import { buildCacheKey } from '../cache/cache-key';
import { NgQlQueryBuilder } from '../query/ng-ql-query-builder';
import type { NgQlQueryContext } from '../query/query-context';
import type { NgQlRequestOptions, NgQlSignalRequestOptions } from '../models/request-options';
import type { NgQlRequestState } from '../models/state';
import { NgQlRequestStateImpl } from '../state/request-state';
import type { NgQlResourceConfig } from './resource-config';

function emptyParams(): HttpParams {
  return new HttpParams({ encoder: new NgQlParamCodec() });
}

/**
 * Base class for a typed HTTP resource. Not an ORM model — it owns no
 * identity map, change tracking, or persistence lifecycle. It is simply a
 * typed façade over `NgQlClient` for one REST endpoint, exposing both a
 * fluent {@link NgQlQueryBuilder} and convenience CRUD methods.
 *
 * ```ts
 * @Injectable()
 * export class PostResource extends NgQlResource<Post> {
 *   constructor(client: NgQlClient) {
 *     super(client, { endpoint: 'posts' });
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class NgQlResource<TModel, TId = string | number> {
  private readonly context: NgQlQueryContext<TModel, TId>;

  protected constructor(
    protected readonly client: NgQlClient,
    protected readonly resourceConfig: NgQlResourceConfig<TModel, TId>,
  ) {
    const adapter = client.config.responseAdapter;
    const endpoint = resourceConfig.endpoint;

    this.context = {
      client,
      endpoint,
      mapItem: resourceConfig.mapItem ?? ((raw) => adapter.adaptItem<TModel>(raw)),
      mapCollection:
        resourceConfig.mapCollection ?? ((raw) => adapter.adaptCollection<TModel>(raw)),
      mapPaginated: resourceConfig.mapPaginated ?? ((raw) => adapter.adaptPaginated<TModel>(raw)),
      buildItemUrl: (id: TId) =>
        resourceConfig.buildUrl
          ? resourceConfig.buildUrl(endpoint, id)
          : `${endpoint.replace(/\/+$/, '')}/${id}`,
      resourceHeaders: resourceConfig.headers,
      resourceOptions: resourceConfig.requestOptions,
      cacheTags: resourceConfig.cacheTags ?? [endpoint],
    };
  }

  /** Starts a new, empty {@link NgQlQueryBuilder} for this resource. */
  query(): NgQlQueryBuilder<TModel, TId> {
    return new NgQlQueryBuilder<TModel, TId>(this.context);
  }

  /**
   * Reads this resource's identifier off a model instance, honoring a custom
   * `primaryKey` from {@link NgQlResourceConfig} (defaults to `'id'`).
   */
  getId(model: TModel): TId {
    const key = this.resourceConfig.primaryKey ?? 'id';
    return (model as unknown as Record<string, unknown>)[key] as TId;
  }

  all(options?: NgQlRequestOptions): Observable<TModel[]> {
    return this.query().get(options);
  }

  allSignal(options?: NgQlSignalRequestOptions): NgQlRequestState<TModel[]> {
    return this.query().getSignal(options);
  }

  find(id: TId, options?: NgQlRequestOptions): Observable<TModel | null> {
    return this.query().find(id, options);
  }

  findSignal(id: TId, options?: NgQlSignalRequestOptions): NgQlRequestState<TModel | null> {
    const destroyRef = inject(DestroyRef);
    const url = this.client.resolveUrl(this.context.buildItemUrl(id));
    const headers = this.client.mergeHeaders(
      this.context.resourceHeaders,
      undefined,
      options?.headers,
    );
    const params = mergeParams(emptyParams(), options?.params);
    const withCredentials =
      options?.withCredentials ?? this.context.resourceOptions?.withCredentials;
    const httpContext = options?.context ?? this.context.resourceOptions?.context;

    const fetch = () =>
      this.client
        .execute<unknown>({
          method: 'GET',
          url,
          params,
          headers,
          withCredentials,
          context: httpContext,
        })
        .pipe(map((raw) => this.context.mapItem(raw)));

    return new NgQlRequestStateImpl<TModel | null>({
      fetch,
      cacheKey: options?.cacheKey ?? buildCacheKey({ method: 'GET', url, params, headers }),
      policy: options?.cache ?? this.client.config.defaultCachePolicy,
      ttl: options?.cacheTtl ?? this.client.config.defaultCacheTtl,
      tags: options?.cacheTags ?? this.context.cacheTags,
      endpoint: this.context.endpoint,
      cache: this.client.cache,
      destroyRef,
    });
  }

  first(options?: NgQlRequestOptions): Observable<TModel | null> {
    return this.query().first(options);
  }

  firstSignal(options?: NgQlSignalRequestOptions): NgQlRequestState<TModel | null> {
    return this.query().firstSignal(options);
  }

  create(payload: Partial<TModel>, options?: NgQlRequestOptions): Observable<TModel> {
    const url = this.client.resolveUrl(this.context.endpoint);
    return this.mutate<unknown>('POST', url, payload, options).pipe(
      map((raw) => this.requireItem(raw)),
    );
  }

  update(id: TId, payload: Partial<TModel>, options?: NgQlRequestOptions): Observable<TModel> {
    const url = this.client.resolveUrl(this.context.buildItemUrl(id));
    return this.mutate<unknown>('PUT', url, payload, options).pipe(
      map((raw) => this.requireItem(raw)),
    );
  }

  patch(id: TId, payload: Partial<TModel>, options?: NgQlRequestOptions): Observable<TModel> {
    const url = this.client.resolveUrl(this.context.buildItemUrl(id));
    return this.mutate<unknown>('PATCH', url, payload, options).pipe(
      map((raw) => this.requireItem(raw)),
    );
  }

  destroy(id: TId, options?: NgQlRequestOptions): Observable<void> {
    const url = this.client.resolveUrl(this.context.buildItemUrl(id));
    return this.mutate<unknown>('DELETE', url, undefined, options).pipe(map(() => undefined));
  }

  private requireItem(raw: unknown): TModel {
    const item = this.context.mapItem(raw);
    if (item === null) {
      throw new Error(
        `ng-ql: expected an item response from "${this.context.endpoint}" but received none.`,
      );
    }
    return item;
  }

  private mutate<T>(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body: unknown,
    options: NgQlRequestOptions | undefined,
  ): Observable<T> {
    const headers = this.client.mergeHeaders(
      this.context.resourceHeaders,
      undefined,
      options?.headers,
    );
    const params = mergeParams(emptyParams(), options?.params);
    const withCredentials =
      options?.withCredentials ?? this.context.resourceOptions?.withCredentials;
    const httpContext = options?.context ?? this.context.resourceOptions?.context;

    return this.client
      .execute<T>({ method, url, params, headers, withCredentials, context: httpContext, body })
      .pipe(
        tap(() =>
          this.client.invalidateAfterMutation(this.context.endpoint, this.context.cacheTags),
        ),
      );
  }
}
