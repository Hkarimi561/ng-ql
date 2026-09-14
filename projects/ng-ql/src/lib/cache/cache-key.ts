import type { HttpHeaders, HttpParams } from '@angular/common/http';

/** Deterministically stable `JSON.stringify`, with object keys sorted. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function normalizeParams(params: HttpParams): string {
  const keys = [...params.keys()].sort();
  return keys.map((key) => `${key}=${[...(params.getAll(key) ?? [])].sort().join('|')}`).join('&');
}

function normalizeHeaders(headers: HttpHeaders | undefined): string {
  if (!headers) return '';
  const keys = [...headers.keys()].sort();
  return keys
    .map((key) => `${key.toLowerCase()}=${(headers.getAll(key) ?? []).slice().sort().join('|')}`)
    .join('&');
}

/**
 * Builds a deterministic cache key from the essential identity of a request.
 * Query parameters and headers are order-independent: equivalent query
 * builders always produce identical keys regardless of chain order.
 */
export function buildCacheKey(input: {
  method: string;
  url: string;
  params: HttpParams;
  headers?: HttpHeaders;
  body?: unknown;
}): string {
  const parts = [
    input.method.toUpperCase(),
    input.url,
    normalizeParams(input.params),
    normalizeHeaders(input.headers),
    input.body !== undefined ? stableStringify(input.body) : '',
  ];
  return parts.join('::');
}
