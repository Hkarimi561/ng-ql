import { HttpParams } from '@angular/common/http';
import type {
  NgQlQueryState,
  NgQlWhereCondition,
  QueryOperator,
  QueryValue,
} from '../models/query-types';
import type { NgQlQuerySerializer } from './query-serializer';
import { NgQlParamCodec } from './ng-ql-param-codec';

const OPERATOR_SUFFIX: Partial<Record<QueryOperator, string>> = {
  '=': '',
  '!=': 'ne',
  '<>': 'ne',
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
  like: 'like',
  'not like': 'not_like',
};

/** Options accepted by {@link DefaultNgQlQuerySerializer}. */
export interface DefaultNgQlQuerySerializerOptions {
  /**
   * Prefix wrapping every filter param, e.g. `'filter'` produces
   * `filter[status]=published`. Pass `null` (or `''`) to emit bare field
   * names instead — `status=published` — for backends that don't use a
   * `filter[...]` envelope. Defaults to `'filter'`.
   */
  readonly filterPrefix?: string | null;
}

/** Renders a scalar `QueryValue` to its wire string form. `null` becomes the literal `"null"`. */
function stringify(value: QueryValue): string {
  if (value === null) return 'null';
  return String(value);
}

/**
 * Splits a flat, chain-ordered where list into AND-groups, breaking at every
 * `'or'` connector (that condition starts a new group; consecutive `'and'`
 * conditions join the current group). See {@link NgQlQueryState}.
 */
function groupWheres(wheres: readonly NgQlWhereCondition[]): NgQlWhereCondition[][] {
  const groups: NgQlWhereCondition[][] = [];
  for (const where of wheres) {
    if (where.connector === 'or' || groups.length === 0) {
      groups.push([where]);
    } else {
      groups[groups.length - 1].push(where);
    }
  }
  return groups;
}

function sortByField(wheres: readonly NgQlWhereCondition[]): NgQlWhereCondition[] {
  return [...wheres].sort((a, b) => a.field.localeCompare(b.field));
}

/** Builds `prefix[field]`, or bare `field` when `prefix` is empty. */
function fieldKey(prefix: string, field: string): string {
  return prefix ? `${prefix}[${field}]` : field;
}

function appendWhere(params: HttpParams, prefix: string, where: NgQlWhereCondition): HttpParams {
  const base = fieldKey(prefix, where.field);
  switch (where.kind) {
    case 'basic': {
      const suffix = OPERATOR_SUFFIX[where.operator] ?? '';
      return params.append(suffix ? `${base}[${suffix}]` : base, stringify(where.value));
    }
    case 'in': {
      const key = where.negate ? `${base}[not_in][]` : `${base}[]`;
      for (const value of where.values) {
        params = params.append(key, stringify(value));
      }
      return params;
    }
    case 'null': {
      const key = where.negate ? `${base}[ne]` : base;
      return params.append(key, 'null');
    }
    case 'between': {
      return params.append(
        `${base}[between]`,
        `${stringify(where.range[0])},${stringify(where.range[1])}`,
      );
    }
  }
}

/**
 * The default {@link NgQlQuerySerializer}, using a widely-adopted REST filtering
 * convention:
 *
 * ```text
 * where('status', 'published')        => filter[status]=published
 * where('price', '>=', 100)           => filter[price][gte]=100
 * whereIn('categoryId', [1, 2])       => filter[categoryId][]=1&filter[categoryId][]=2
 * whereNotIn('categoryId', [1, 2])    => filter[categoryId][not_in][]=1&filter[categoryId][not_in][]=2
 * whereNull('deletedAt')              => filter[deletedAt]=null
 * whereNotNull('deletedAt')           => filter[deletedAt][ne]=null
 * whereBetween('price', [10, 20])     => filter[price][between]=10,20
 * select(['id', 'title'])             => fields=id,title
 * with('author')                      => include=author
 * orderBy('createdAt', 'desc')        => sort=-createdAt
 * limit(10)                           => page[size]=10
 * offset(20)                          => page[offset]=20
 * page(2, 20)                         => page[number]=2&page[size]=20
 * ```
 *
 * `where(a).where(b)` (no `orWhere` anywhere in the chain) is a single AND
 * group and serializes exactly as above, in a stable field-sorted order so
 * equivalent query builders always serialize identically regardless of the
 * order chain methods were called in.
 *
 * Once `orWhere` appears anywhere in the chain, the whole where-list is
 * partitioned into AND-groups split at each `orWhere` (see
 * {@link NgQlQueryState}) and every group — including the first — is nested
 * under `filter[or][<groupIndex>]` instead of `filter`:
 *
 * ```text
 * where('status', 'published').orWhere('featured', true)
 *   => filter[or][0][status]=published&filter[or][1][featured]=true
 * ```
 *
 * The `filter[...]` wrapper itself is optional — pass `filterPrefix: null`
 * to emit bare field names instead:
 *
 * ```ts
 * new DefaultNgQlQuerySerializer({ filterPrefix: null });
 * // where('id', 1122)                          => id=1122
 * // where('status', 'published').orWhere(...)  => or[0][status]=published&or[1][...]
 * ```
 */
export class DefaultNgQlQuerySerializer implements NgQlQuerySerializer {
  private readonly filterPrefix: string;

  constructor(options?: DefaultNgQlQuerySerializerOptions) {
    const prefix = options?.filterPrefix;
    // `??` alone can't distinguish "option omitted" from "explicitly null" (both
    // are nullish), so check for `undefined` first — only that case defaults to
    // 'filter'; an explicit `null` must fall through to the bare-field mode.
    this.filterPrefix = prefix === undefined ? 'filter' : (prefix ?? '');
  }

  serialize(state: NgQlQueryState): HttpParams {
    let params = new HttpParams({ encoder: new NgQlParamCodec() });

    const groups = groupWheres(state.wheres);
    if (groups.length <= 1) {
      for (const where of sortByField(groups[0] ?? [])) {
        params = appendWhere(params, this.filterPrefix, where);
      }
    } else {
      const orRoot = this.filterPrefix ? `${this.filterPrefix}[or]` : 'or';
      groups.forEach((group, index) => {
        for (const where of sortByField(group)) {
          params = appendWhere(params, `${orRoot}[${index}]`, where);
        }
      });
    }

    if (state.selects.length > 0) {
      params = params.append('fields', [...state.selects].join(','));
    }

    if (state.includes.length > 0) {
      params = params.append('include', [...state.includes].join(','));
    }

    if (state.sorts.length > 0) {
      const sort = state.sorts
        .map((s) => (s.direction === 'desc' ? `-${s.field}` : s.field))
        .join(',');
      params = params.append('sort', sort);
    }

    if (state.pageValue !== undefined) {
      params = params.append('page[number]', String(state.pageValue));
    }
    if (state.perPageValue !== undefined) {
      params = params.append('page[size]', String(state.perPageValue));
    } else if (state.limitValue !== undefined) {
      params = params.append('page[size]', String(state.limitValue));
    }
    if (state.offsetValue !== undefined) {
      params = params.append('page[offset]', String(state.offsetValue));
    }

    for (const extra of [...state.extraParams].sort((a, b) => a.key.localeCompare(b.key))) {
      const { key, value } = extra;
      if (value === undefined) continue;
      if (value === null) {
        params = params.append(key, 'null');
      } else if (Array.isArray(value)) {
        for (const v of value) {
          params = params.append(`${key}[]`, stringify(v));
        }
      } else {
        params = params.append(key, stringify(value as QueryValue));
      }
    }

    return params;
  }
}
