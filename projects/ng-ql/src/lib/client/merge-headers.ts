import { HttpHeaders } from '@angular/common/http';

export type HeaderInput = HttpHeaders | Record<string, string | string[]> | undefined;

function toHttpHeaders(input: HeaderInput): HttpHeaders {
  if (input instanceof HttpHeaders) return input;
  return new HttpHeaders(input ?? {});
}

/**
 * Merges header sources in ascending precedence order (later sources win on
 * key conflicts): global defaults, resource defaults, builder headers, and
 * per-request headers.
 */
export function mergeHeaders(...sources: HeaderInput[]): HttpHeaders {
  let result = new HttpHeaders();
  for (const source of sources) {
    const headers = toHttpHeaders(source);
    for (const key of headers.keys()) {
      const values = headers.getAll(key);
      if (values) {
        result = result.set(key, values);
      }
    }
  }
  return result;
}
