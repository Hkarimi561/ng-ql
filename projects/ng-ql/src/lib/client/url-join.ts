const ABSOLUTE_URL = /^([a-z][a-z\d+\-.]*:)?\/\//i;

/** Whether `url` is already absolute (has a scheme, or is protocol-relative). */
export function isAbsoluteUrl(url: string): boolean {
  return ABSOLUTE_URL.test(url);
}

/**
 * Joins a base URL and an endpoint segment without duplicating or dropping
 * the slash between them. If `segment` is already absolute, it is returned
 * untouched (never double-prefixed with `base`).
 */
export function joinUrl(base: string, segment: string): string {
  if (isAbsoluteUrl(segment)) {
    return segment;
  }
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedSegment = segment.replace(/^\/+/, '');
  if (trimmedBase === '') return `/${trimmedSegment}`;
  if (trimmedSegment === '') return trimmedBase;
  return `${trimmedBase}/${trimmedSegment}`;
}
