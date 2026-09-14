import type {
  NgQlPaginationLinks,
  NgQlPaginationMeta,
  NgQlPaginatedResponse,
} from '../models/pagination';
import type { NgQlResponseAdapter } from './response-adapter';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOf(record: UnknownRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function stringOrNull(record: UnknownRecord, key: string): string | null | undefined {
  const value = record[key];
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * Default {@link NgQlResponseAdapter}, supporting the common response shapes:
 *
 * - A raw array: `[{...}, {...}]`
 * - A `data`-wrapped collection: `{ data: [{...}, {...}] }`
 * - A `data`-wrapped item: `{ data: {...} }`
 * - A raw item object: `{...}`
 * - A JSON:API-ish paginated collection with `data`, `meta` (`current_page`,
 *   `last_page`, `per_page`, `total`, or their camelCase equivalents) and an
 *   optional `links` object (`first`, `last`, `prev`, `next`).
 */
export class DefaultNgQlResponseAdapter implements NgQlResponseAdapter {
  adaptCollection<TModel>(raw: unknown): TModel[] {
    if (Array.isArray(raw)) {
      return raw as TModel[];
    }
    if (isRecord(raw) && Array.isArray(raw['data'])) {
      return raw['data'] as TModel[];
    }
    return [];
  }

  adaptItem<TModel>(raw: unknown): TModel | null {
    if (raw === null || raw === undefined) {
      return null;
    }
    if (isRecord(raw) && 'data' in raw) {
      const data = raw['data'];
      if (data === null || data === undefined) return null;
      return data as TModel;
    }
    if (isRecord(raw)) {
      return raw as unknown as TModel;
    }
    return null;
  }

  adaptPaginated<TModel>(raw: unknown): NgQlPaginatedResponse<TModel> {
    const data = this.adaptCollection<TModel>(raw);

    let meta: NgQlPaginationMeta = { currentPage: 1, perPage: data.length, total: data.length };
    let links: NgQlPaginationLinks | undefined;

    if (isRecord(raw)) {
      const rawMeta = isRecord(raw['meta']) ? (raw['meta'] as UnknownRecord) : raw;
      const currentPage = numberOf(rawMeta, 'currentPage', 'current_page') ?? 1;
      const perPage = numberOf(rawMeta, 'perPage', 'per_page') ?? data.length;
      const total = numberOf(rawMeta, 'total') ?? data.length;
      const lastPage = numberOf(rawMeta, 'lastPage', 'last_page');
      meta = { currentPage, perPage, total, ...(lastPage !== undefined ? { lastPage } : {}) };

      if (isRecord(raw['links'])) {
        const rawLinks = raw['links'] as UnknownRecord;
        links = {
          first: stringOrNull(rawLinks, 'first'),
          last: stringOrNull(rawLinks, 'last'),
          prev: stringOrNull(rawLinks, 'prev'),
          next: stringOrNull(rawLinks, 'next'),
        };
      }
    }

    return { data, meta, ...(links ? { links } : {}), raw };
  }
}
