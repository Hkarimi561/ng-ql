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

/**
 * How a condition relates to the one before it in the chain. `'and'` (the
 * default, used by `where`) joins the current group; `'or'` (used by
 * `orWhere`) starts a new group. See {@link NgQlQueryState} for how groups
 * are serialized.
 */
export type NgQlWhereConnector = 'and' | 'or';

/** A single `where`/`orWhere` condition, discriminated by `kind`. */
export type NgQlWhereCondition =
  | {
      readonly kind: 'basic';
      readonly field: string;
      readonly operator: QueryOperator;
      readonly value: QueryValue;
      readonly connector: NgQlWhereConnector;
    }
  | {
      readonly kind: 'in';
      readonly field: string;
      readonly values: readonly QueryValue[];
      readonly negate: boolean;
      readonly connector: NgQlWhereConnector;
    }
  | {
      readonly kind: 'null';
      readonly field: string;
      readonly negate: boolean;
      readonly connector: NgQlWhereConnector;
    }
  | {
      readonly kind: 'between';
      readonly field: string;
      readonly range: readonly [QueryValue, QueryValue];
      readonly connector: NgQlWhereConnector;
    };

/**
 * Immutable snapshot of a query builder's accumulated state.
 * Passed to a {@link NgQlQuerySerializer} to be turned into `HttpParams`.
 *
 * `wheres` is a flat, chain-ordered list; each condition's `connector` says
 * how it relates to the one before it. A serializer partitions this into
 * groups by splitting at every `'or'` (that condition starts a new group;
 * consecutive `'and'` conditions join the current group) — i.e.
 * `where(a).where(b).orWhere(c).where(d)` groups as `[a, b]` OR `[c, d]`,
 * matching Eloquent's `orWhere` semantics.
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
