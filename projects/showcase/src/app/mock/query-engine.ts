import type { HttpParams } from '@angular/common/http';

type Row = Record<string, unknown>;

interface ParsedFilter {
  readonly field: string;
  readonly suffix?: string;
  readonly isArray: boolean;
  readonly values: string[];
}

const FILTER_KEY = /^filter\[([^[\]]+)](?:\[([^[\]]+)])?(\[])?$/;

function parseFilters(params: HttpParams): ParsedFilter[] {
  const filters: ParsedFilter[] = [];
  for (const key of params.keys()) {
    const match = FILTER_KEY.exec(key);
    if (!match) continue;
    const [, field, bracket, arrayMarker] = match;
    const isArray = bracket === '[]' || arrayMarker === '[]' || key.endsWith('[]');
    const suffix = bracket && bracket !== '[]' ? bracket : undefined;
    filters.push({ field, suffix, isArray, values: params.getAll(key) ?? [] });
  }
  return filters;
}

function coerce(value: unknown, sample: unknown): unknown {
  if (typeof sample === 'number') return Number(value);
  if (typeof sample === 'boolean') return String(value) === 'true';
  return value;
}

function matchesFilter(row: Row, filter: ParsedFilter): boolean {
  const actual = row[filter.field];

  if (filter.isArray) {
    const wanted = filter.values.map((v) => coerce(v, actual));
    const isIn = wanted.includes(actual as never);
    return filter.suffix === 'not_in' ? !isIn : isIn;
  }

  const raw = filter.values[0];
  if (raw === 'null') {
    const isNull = actual === null || actual === undefined;
    return filter.suffix === 'ne' ? !isNull : isNull;
  }

  if (filter.suffix === 'between') {
    const [minRaw, maxRaw] = raw.split(',');
    const min = coerce(minRaw, actual) as number;
    const max = coerce(maxRaw, actual) as number;
    return (actual as number) >= min && (actual as number) <= max;
  }

  const wanted = coerce(raw, actual);
  switch (filter.suffix) {
    case 'ne':
      return actual !== wanted;
    case 'gt':
      return (actual as number) > (wanted as number);
    case 'gte':
      return (actual as number) >= (wanted as number);
    case 'lt':
      return (actual as number) < (wanted as number);
    case 'lte':
      return (actual as number) <= (wanted as number);
    case 'like':
    case 'not_like': {
      const haystack = String(actual).toLowerCase();
      const needle = String(wanted).toLowerCase().replace(/%/g, '');
      const contains = haystack.includes(needle);
      return filter.suffix === 'not_like' ? !contains : contains;
    }
    default:
      return actual === wanted;
  }
}

function applyIncludes(rows: Row[], includes: readonly string[]): Row[] {
  if (includes.length === 0) return rows;
  return rows.map((row) => {
    const withRelations: Row = { ...row };
    for (const relation of includes) {
      if (relation === 'author' && 'authorId' in row) {
        withRelations['author'] = { id: row['authorId'], name: `Author ${row['authorId']}` };
      } else if (relation === 'category' && 'categoryId' in row) {
        withRelations['category'] = {
          id: row['categoryId'],
          name: `Category ${row['categoryId']}`,
        };
      } else if (!(relation in withRelations)) {
        withRelations[relation] = [];
      }
    }
    return withRelations;
  });
}

function applySelect(rows: Row[], fields: readonly string[]): Row[] {
  if (fields.length === 0) return rows;
  return rows.map((row) => {
    const projected: Row = {};
    for (const field of fields) {
      if (field in row) projected[field] = row[field];
    }
    return projected;
  });
}

export interface MockQueryResult {
  readonly data: Row[];
  readonly currentPage: number;
  readonly perPage: number;
  readonly total: number;
  readonly lastPage: number;
}

/** Applies ng-ql's default query-serializer conventions against an in-memory dataset. */
export function runMockQuery(dataset: readonly Row[], params: HttpParams): MockQueryResult {
  const filters = parseFilters(params);
  let rows = dataset.filter((row) => filters.every((f) => matchesFilter(row, f)));

  const sort = params.get('sort');
  if (sort) {
    const clauses = sort
      .split(',')
      .map((s) => (s.startsWith('-') ? { field: s.slice(1), dir: -1 } : { field: s, dir: 1 }));
    rows = [...rows].sort((a, b) => {
      for (const clause of clauses) {
        const av = a[clause.field];
        const bv = b[clause.field];
        if (av === bv) continue;
        return (av as number) > (bv as number) ? clause.dir : -clause.dir;
      }
      return 0;
    });
  }

  const total = rows.length;
  const perPage = Number(params.get('page[size]') ?? (total || 1));
  const currentPage = Number(params.get('page[number]') ?? 1);
  const offset = params.has('page[offset]')
    ? Number(params.get('page[offset]'))
    : (currentPage - 1) * perPage;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const paged = rows.slice(offset, offset + perPage);

  const includes = (params.get('include') ?? '').split(',').filter(Boolean);
  const withIncludes = applyIncludes(paged, includes);

  const fields = (params.get('fields') ?? '').split(',').filter(Boolean);
  const data = applySelect(withIncludes, fields);

  return { data, currentPage, perPage, total, lastPage };
}
