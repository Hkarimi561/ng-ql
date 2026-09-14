/**
 * Cache behavior for a signal-based request.
 *
 * - `no-store`: always execute the HTTP request; never read or write the cache.
 * - `cache-first`: return valid cached data immediately if present; otherwise fetch.
 * - `network-first`: attempt a fresh request first; fall back to cached data on failure.
 * - `stale-while-revalidate`: return cached data immediately (if any) while a background
 *   request refreshes both the signal state and the cache.
 */
export type NgQlCachePolicy =
  | 'no-store'
  | 'cache-first'
  | 'network-first'
  | 'stale-while-revalidate';
