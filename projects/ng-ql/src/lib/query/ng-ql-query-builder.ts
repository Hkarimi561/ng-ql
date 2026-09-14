import { HttpHeaders, type HttpParams } from '@angular/common/http';
import { DestroyRef, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { NgQlPaginatedResponse } from '../models/pagination';
import type { NgQlRequestOptions, NgQlSignalRequestOptions } from '../models/request-options';
import type { NgQlRequestState, NgQlPaginatedRequestState } from '../models/state';
import type { NgQlRequestDescription } from '../models/request-description';
import type {
  NgQlExtraParam,
  NgQlQueryState,
  NgQlSortClause,
  NgQlWhereCondition,
  NgQlWhereConnector,
  QueryOperator,
  QueryValue,
  SortDirection,
} from '../models/query-types';
import { mergeHeaders, type HeaderInput } from '../client/merge-headers';
import { mergeParams } from '../client/merge-params';
import type { NgQlPreparedRequest } from '../client/ng-ql-client';
import { buildCacheKey } from '../cache/cache-key';
import { NgQlRequestStateImpl } from '../state/request-state';
import { NgQlPaginatedRequestStateImpl } from '../state/paginated-request-state';
import { NgQlValidationError } from '../errors/ng-ql-validation-error';
import { assertNonNegativeInteger, assertPositiveInteger } from './query-validation';
import type { NgQlQueryContext } from './query-context';

const EMPTY_STATE: NgQlQueryState = {
  wheres: [],
  selects: [],
  includes: [],
  sorts: [],
  extraParams: [],
};

const KNOWN_OPERATORS: readonly QueryOperator[] = [
  '=',
  '!=',
  '<>',
  '>',
  '>=',
  '<',
  '<=',
  'like',
  'not like',
];

function isQueryOperator(value: unknown): value is QueryOperator {
  return typeof value === 'string' && (KNOWN_OPERATORS as readonly string[]).includes(value);
}

/**
 * An immutable, Eloquent-inspired query builder for a single {@link NgQlResource}.
 *
 * Every chain method returns a *new* builder instance; the receiver is never
 * mutated. No HTTP request is made until an execution method (`get`, `first`,
 * `paginate`, `find`, or their `*Signal` counterparts) is called.
 */
export class NgQlQueryBuilder<TModel, TId = string | number> {
  constructor(
    private readonly context: NgQlQueryContext<TModel, TId>,
    private readonly state: NgQlQueryState = EMPTY_STATE,
    private readonly builderHeaders?: HeaderInput,
    private readonly builderOptions?: NgQlRequestOptions,
  ) {}

  private fork(
    state: NgQlQueryState,
    headers: HeaderInput = this.builderHeaders,
    options: NgQlRequestOptions | undefined = this.builderOptions,
  ): NgQlQueryBuilder<TModel, TId> {
    return new NgQlQueryBuilder<TModel, TId>(this.context, state, headers, options);
  }

  // ---------------------------------------------------------------------
  // Chain methods
  // ---------------------------------------------------------------------

  /** Adds one equality condition per entry, AND-ed with each other and with the existing chain. */
  where(conditions: Record<string, QueryValue>): NgQlQueryBuilder<TModel, TId>;
  /** Shorthand `where(field, value)` for equality, or explicit `where(field, operator, value)`. */
  where(
    field: string,
    operatorOrValue: QueryValue | QueryOperator,
    value?: QueryValue,
  ): NgQlQueryBuilder<TModel, TId>;
  where(
    fieldOrConditions: string | Record<string, QueryValue>,
    operatorOrValue?: QueryValue | QueryOperator,
    value?: QueryValue,
  ): NgQlQueryBuilder<TModel, TId> {
    if (typeof fieldOrConditions !== 'string') {
      return this.whereEntries(fieldOrConditions, 'and');
    }
    return this.addBasicWhere(
      fieldOrConditions,
      operatorOrValue as QueryValue | QueryOperator,
      value,
      'and',
    );
  }

  /** Adds one equality condition per entry, AND-ed with each other, OR-ed with the existing chain. */
  orWhere(conditions: Record<string, QueryValue>): NgQlQueryBuilder<TModel, TId>;
  /** Shorthand `orWhere(field, value)` for equality, or explicit `orWhere(field, operator, value)`. */
  orWhere(
    field: string,
    operatorOrValue: QueryValue | QueryOperator,
    value?: QueryValue,
  ): NgQlQueryBuilder<TModel, TId>;
  orWhere(
    fieldOrConditions: string | Record<string, QueryValue>,
    operatorOrValue?: QueryValue | QueryOperator,
    value?: QueryValue,
  ): NgQlQueryBuilder<TModel, TId> {
    if (typeof fieldOrConditions !== 'string') {
      return this.whereEntries(fieldOrConditions, 'or');
    }
    return this.addBasicWhere(
      fieldOrConditions,
      operatorOrValue as QueryValue | QueryOperator,
      value,
      'or',
    );
  }

  whereIn(field: string, values: readonly QueryValue[]): NgQlQueryBuilder<TModel, TId> {
    const condition: NgQlWhereCondition = {
      kind: 'in',
      field,
      values: [...values],
      negate: false,
      connector: 'and',
    };
    return this.fork({ ...this.state, wheres: [...this.state.wheres, condition] });
  }

  whereNotIn(field: string, values: readonly QueryValue[]): NgQlQueryBuilder<TModel, TId> {
    const condition: NgQlWhereCondition = {
      kind: 'in',
      field,
      values: [...values],
      negate: true,
      connector: 'and',
    };
    return this.fork({ ...this.state, wheres: [...this.state.wheres, condition] });
  }

  whereNull(field: string): NgQlQueryBuilder<TModel, TId> {
    const condition: NgQlWhereCondition = { kind: 'null', field, negate: false, connector: 'and' };
    return this.fork({ ...this.state, wheres: [...this.state.wheres, condition] });
  }

  whereNotNull(field: string): NgQlQueryBuilder<TModel, TId> {
    const condition: NgQlWhereCondition = { kind: 'null', field, negate: true, connector: 'and' };
    return this.fork({ ...this.state, wheres: [...this.state.wheres, condition] });
  }

  whereBetween(
    field: string,
    range: readonly [QueryValue, QueryValue],
  ): NgQlQueryBuilder<TModel, TId> {
    const condition: NgQlWhereCondition = {
      kind: 'between',
      field,
      range: [range[0], range[1]],
      connector: 'and',
    };
    return this.fork({ ...this.state, wheres: [...this.state.wheres, condition] });
  }

  when(
    condition: boolean,
    callback: (query: NgQlQueryBuilder<TModel, TId>) => NgQlQueryBuilder<TModel, TId>,
  ): NgQlQueryBuilder<TModel, TId> {
    return condition ? callback(this) : this;
  }

  select(fields: readonly string[]): NgQlQueryBuilder<TModel, TId> {
    return this.fork({ ...this.state, selects: [...new Set(fields)] });
  }

  with(relations: string | readonly string[]): NgQlQueryBuilder<TModel, TId> {
    const incoming = Array.isArray(relations) ? relations : [relations as string];
    return this.fork({
      ...this.state,
      includes: [...new Set([...this.state.includes, ...incoming])],
    });
  }

  withQuery(
    params: Record<string, QueryValue | readonly QueryValue[] | null | undefined>,
  ): NgQlQueryBuilder<TModel, TId> {
    return this.fork({ ...this.state, extraParams: this.mergeExtraParams(params) });
  }

  /** Alias of {@link withQuery}, for readability when appending one-off params. */
  append(
    params: Record<string, QueryValue | readonly QueryValue[] | null | undefined>,
  ): NgQlQueryBuilder<TModel, TId> {
    return this.withQuery(params);
  }

  orderBy(field: string, direction: SortDirection = 'asc'): NgQlQueryBuilder<TModel, TId> {
    const sorts: NgQlSortClause[] = [
      ...this.state.sorts.filter((s) => s.field !== field),
      { field, direction },
    ];
    return this.fork({ ...this.state, sorts });
  }

  latest(field = 'createdAt'): NgQlQueryBuilder<TModel, TId> {
    return this.orderBy(field, 'desc');
  }

  oldest(field = 'createdAt'): NgQlQueryBuilder<TModel, TId> {
    return this.orderBy(field, 'asc');
  }

  limit(value: number): NgQlQueryBuilder<TModel, TId> {
    assertPositiveInteger(value, 'limit');
    return this.fork({ ...this.state, limitValue: value });
  }

  offset(value: number): NgQlQueryBuilder<TModel, TId> {
    assertNonNegativeInteger(value, 'offset');
    return this.fork({ ...this.state, offsetValue: value });
  }

  page(page: number, perPage?: number): NgQlQueryBuilder<TModel, TId> {
    assertPositiveInteger(page, 'page');
    if (perPage !== undefined) assertPositiveInteger(perPage, 'perPage');
    return this.fork({
      ...this.state,
      pageValue: page,
      ...(perPage !== undefined ? { perPageValue: perPage } : {}),
    });
  }

  perPage(value: number): NgQlQueryBuilder<TModel, TId> {
    assertPositiveInteger(value, 'perPage');
    return this.fork({ ...this.state, perPageValue: value });
  }

  setHeaders(
    headers: HttpHeaders | Record<string, string | string[]>,
  ): NgQlQueryBuilder<TModel, TId> {
    return this.fork(this.state, mergeHeaders(this.builderHeaders, headers));
  }

  setOptions(options: NgQlRequestOptions): NgQlQueryBuilder<TModel, TId> {
    return this.fork(this.state, this.builderHeaders, { ...this.builderOptions, ...options });
  }

  // ---------------------------------------------------------------------
  // Observable execution methods
  // ---------------------------------------------------------------------

  get(options?: NgQlRequestOptions): Observable<TModel[]> {
    const { url, params, headers, withCredentials, context } = this.resolve(
      this.context.endpoint,
      options,
    );
    return this.context.client
      .execute<unknown>({ method: 'GET', url, params, headers, withCredentials, context })
      .pipe(map((raw) => this.context.mapCollection(raw)));
  }

  first(options?: NgQlRequestOptions): Observable<TModel | null> {
    return this.limit(1)
      .get(options)
      .pipe(map((items) => items[0] ?? null));
  }

  paginate(
    page?: number,
    perPage?: number,
    options?: NgQlRequestOptions,
  ): Observable<NgQlPaginatedResponse<TModel>> {
    const builder =
      page !== undefined
        ? this.page(page, perPage)
        : perPage !== undefined
          ? this.perPage(perPage)
          : this;
    const { url, params, headers, withCredentials, context } = builder.resolve(
      builder.context.endpoint,
      options,
    );
    return builder.context.client
      .execute<unknown>({ method: 'GET', url, params, headers, withCredentials, context })
      .pipe(map((raw) => builder.context.mapPaginated(raw)));
  }

  find(id: TId, options?: NgQlRequestOptions): Observable<TModel | null> {
    const { url, params, headers, withCredentials, context } = this.resolve(
      this.context.buildItemUrl(id),
      options,
    );
    return this.context.client
      .execute<unknown>({ method: 'GET', url, params, headers, withCredentials, context })
      .pipe(map((raw) => this.context.mapItem(raw)));
  }

  // ---------------------------------------------------------------------
  // Signal execution methods
  // ---------------------------------------------------------------------

  getSignal(options?: NgQlSignalRequestOptions): NgQlRequestState<TModel[]> {
    const destroyRef = inject(DestroyRef);
    const { url, params, headers, withCredentials, context } = this.resolve(
      this.context.endpoint,
      options,
    );
    const fetch = () =>
      this.context.client
        .execute<unknown>({ method: 'GET', url, params, headers, withCredentials, context })
        .pipe(map((raw) => this.context.mapCollection(raw)));

    return new NgQlRequestStateImpl<TModel[]>({
      fetch,
      cacheKey: options?.cacheKey ?? buildCacheKey({ method: 'GET', url, params, headers }),
      policy: options?.cache ?? this.context.client.config.defaultCachePolicy,
      ttl: options?.cacheTtl ?? this.context.client.config.defaultCacheTtl,
      tags: options?.cacheTags ?? this.context.cacheTags,
      endpoint: this.context.endpoint,
      cache: this.context.client.cache,
      destroyRef,
    });
  }

  firstSignal(options?: NgQlSignalRequestOptions): NgQlRequestState<TModel | null> {
    const destroyRef = inject(DestroyRef);
    const limited = this.limit(1);
    const { url, params, headers, withCredentials, context } = limited.resolve(
      limited.context.endpoint,
      options,
    );
    const fetch = () =>
      limited.context.client
        .execute<unknown>({ method: 'GET', url, params, headers, withCredentials, context })
        .pipe(map((raw) => limited.context.mapCollection(raw)[0] ?? null));

    return new NgQlRequestStateImpl<TModel | null>({
      fetch,
      cacheKey: options?.cacheKey ?? buildCacheKey({ method: 'GET', url, params, headers }),
      policy: options?.cache ?? this.context.client.config.defaultCachePolicy,
      ttl: options?.cacheTtl ?? this.context.client.config.defaultCacheTtl,
      tags: options?.cacheTags ?? this.context.cacheTags,
      endpoint: this.context.endpoint,
      cache: this.context.client.cache,
      destroyRef,
    });
  }

  paginateSignal(
    page?: number,
    perPage?: number,
    options?: NgQlSignalRequestOptions,
  ): NgQlPaginatedRequestState<TModel> {
    const destroyRef = inject(DestroyRef);
    const initialPage = page ?? this.state.pageValue ?? 1;
    const initialPerPage = perPage ?? this.state.perPageValue ?? 15;

    const describe = (p: number, pp: number) => {
      const builder = this.page(p, pp);
      const { url, params, headers, withCredentials, context } = builder.resolve(
        builder.context.endpoint,
        options,
      );
      const fetch = () =>
        builder.context.client
          .execute<unknown>({ method: 'GET', url, params, headers, withCredentials, context })
          .pipe(map((raw) => builder.context.mapPaginated(raw)));
      return {
        fetch,
        cacheKey: options?.cacheKey ?? buildCacheKey({ method: 'GET', url, params, headers }),
      };
    };

    return new NgQlPaginatedRequestStateImpl<TModel>({
      describe,
      initialPage,
      initialPerPage,
      policy: options?.cache ?? this.context.client.config.defaultCachePolicy,
      ttl: options?.cacheTtl ?? this.context.client.config.defaultCacheTtl,
      tags: options?.cacheTags ?? this.context.cacheTags,
      endpoint: this.context.endpoint,
      cache: this.context.client.cache,
      destroyRef,
    });
  }

  // ---------------------------------------------------------------------
  // Inspection methods
  // ---------------------------------------------------------------------

  toUrl(): string {
    const { url, params } = this.resolve(this.context.endpoint);
    const query = params.toString();
    return query ? `${url}?${query}` : url;
  }

  toQueryParams(): HttpParams {
    return this.resolve(this.context.endpoint).params;
  }

  toRequest(): NgQlRequestDescription {
    const { url, params, headers, withCredentials } = this.resolve(this.context.endpoint);
    return { method: 'GET', url, params, headers, withCredentials };
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private requireOperator(value: QueryValue | QueryOperator): QueryOperator {
    if (isQueryOperator(value)) return value;
    throw new NgQlValidationError(`ng-ql: "${String(value)}" is not a valid query operator.`);
  }

  private addBasicWhere(
    field: string,
    operatorOrValue: QueryValue | QueryOperator,
    value: QueryValue | undefined,
    connector: NgQlWhereConnector,
  ): NgQlQueryBuilder<TModel, TId> {
    const condition: NgQlWhereCondition =
      value === undefined
        ? { kind: 'basic', field, operator: '=', value: operatorOrValue as QueryValue, connector }
        : {
            kind: 'basic',
            field,
            operator: this.requireOperator(operatorOrValue),
            value,
            connector,
          };
    return this.fork({ ...this.state, wheres: [...this.state.wheres, condition] });
  }

  /** Applies each entry of an object-form `where`/`orWhere` as an equality condition. */
  private whereEntries(
    conditions: Record<string, QueryValue>,
    connector: NgQlWhereConnector,
  ): NgQlQueryBuilder<TModel, TId> {
    const additions: NgQlWhereCondition[] = Object.entries(conditions).map(
      ([field, value], index) => ({
        kind: 'basic',
        field,
        operator: '=',
        value,
        connector: index === 0 ? connector : 'and',
      }),
    );
    return this.fork({ ...this.state, wheres: [...this.state.wheres, ...additions] });
  }

  private mergeExtraParams(
    params: Record<string, QueryValue | readonly QueryValue[] | null | undefined>,
  ): NgQlExtraParam[] {
    const byKey = new Map(this.state.extraParams.map((p) => [p.key, p] as const));
    for (const [key, value] of Object.entries(params)) {
      byKey.set(key, { key, value });
    }
    return [...byKey.values()];
  }

  private resolve(
    endpoint: string,
    options?: NgQlRequestOptions,
  ): {
    url: string;
    params: HttpParams;
    headers: HttpHeaders;
    withCredentials?: boolean;
    context?: NgQlPreparedRequest['context'];
  } {
    const url = this.context.client.resolveUrl(endpoint);
    const serialized = this.context.client.config.querySerializer.serialize(this.state);
    const params = mergeParams(serialized, options?.params);
    const headers = this.context.client.mergeHeaders(
      this.context.resourceHeaders,
      this.builderHeaders,
      options?.headers,
    );
    const withCredentials =
      options?.withCredentials ??
      this.builderOptions?.withCredentials ??
      this.context.resourceOptions?.withCredentials;
    const context =
      options?.context ?? this.builderOptions?.context ?? this.context.resourceOptions?.context;
    return { url, params, headers, withCredentials, context };
  }
}
