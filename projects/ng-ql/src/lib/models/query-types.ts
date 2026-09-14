/** A scalar value usable in a query filter, sort, or pagination parameter. */
export type QueryValue = string | number | boolean | null;

/** Comparison operators supported by {@link NgQlQueryBuilder#where}. */
export type QueryOperator = '=' | '!=' | '<>' | '>' | '>=' | '<' | '<=' | 'like' | 'not like';

/** Sort direction for {@link NgQlQueryBuilder#orderBy}. */
export type SortDirection = 'asc' | 'desc';

/** A single `orderBy` clause. */
export interface NgQlSortClause {
  readonly field: string;
  readonly direction: SortDirection;
}

/** A single `append`/`withQuery` raw parameter entry. */
export interface NgQlExtraParam {
  readonly key: string;
  readonly value: QueryValue | readonly QueryValue[] | null | undefined;
}

/** A single `where` condition, discriminated by `kind`. */
export type NgQlWhereCondition =
  | {
      readonly kind: 'basic';
      readonly field: string;
      readonly operator: QueryOperator;
      readonly value: QueryValue;
    }
  | {
      readonly kind: 'in';
      readonly field: string;
      readonly values: readonly QueryValue[];
      readonly negate: boolean;
    }
  | { readonly kind: 'null'; readonly field: string; readonly negate: boolean }
  | {
      readonly kind: 'between';
      readonly field: string;
      readonly range: readonly [QueryValue, QueryValue];
    };

/**
 * Immutable snapshot of a query builder's accumulated state.
 * Passed to a {@link NgQlQuerySerializer} to be turned into `HttpParams`.
 */
export interface NgQlQueryState {
  readonly wheres: readonly NgQlWhereCondition[];
  readonly selects: readonly string[];
  readonly includes: readonly string[];
  readonly sorts: readonly NgQlSortClause[];
  readonly limitValue?: number;
  readonly offsetValue?: number;
  readonly pageValue?: number;
  readonly perPageValue?: number;
  readonly extraParams: readonly NgQlExtraParam[];
}

/** The HTTP verbs ng-ql knows how to issue. */
export type NgQlHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
