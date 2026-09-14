import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NgQlCacheService } from './ng-ql-cache.service';
import { buildCacheKey } from './cache-key';
import { HttpParams } from '@angular/common/http';

describe('NgQlCacheService', () => {
  let cache: NgQlCacheService;

  beforeEach(() => {
    cache = new NgQlCacheService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and returns a value while unexpired', () => {
    cache.set('k', 42, { ttl: 1000 });
    expect(cache.get<number>('k')).toBe(42);
  });

  it('expires a value after its TTL elapses', () => {
    cache.set('k', 42, { ttl: 1000 });
    vi.advanceTimersByTime(1001);
    expect(cache.get<number>('k')).toBeUndefined();
  });

  it('never expires a value with ttl <= 0', () => {
    cache.set('k', 42, { ttl: 0 });
    vi.advanceTimersByTime(1_000_000);
    expect(cache.get<number>('k')).toBe(42);
  });

  it('peek returns the value and whether it is expired, without evicting it', () => {
    cache.set('k', 42, { ttl: 10 });
    vi.advanceTimersByTime(11);
    const peeked = cache.peek<number>('k');
    expect(peeked).toEqual({ value: 42, expired: true });
  });

  it('invalidates a single key', () => {
    cache.set('a', 1, { ttl: 1000 });
    cache.set('b', 2, { ttl: 1000 });
    cache.invalidateKey('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('invalidates every entry sharing a tag', () => {
    cache.set('a', 1, { ttl: 1000, tags: ['posts'] });
    cache.set('b', 2, { ttl: 1000, tags: ['posts', 'featured'] });
    cache.set('c', 3, { ttl: 1000, tags: ['users'] });
    cache.invalidateTag('posts');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('invalidates every entry owned by an endpoint', () => {
    cache.set('a', 1, { ttl: 1000, endpoint: 'posts' });
    cache.set('b', 2, { ttl: 1000, endpoint: 'users' });
    cache.invalidateEndpoint('posts');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('clears every entry', () => {
    cache.set('a', 1, { ttl: 1000 });
    cache.set('b', 2, { ttl: 1000 });
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('deduplicates concurrent identical in-flight requests into a single source subscription', () => {
    let calls = 0;
    const source = () => {
      calls++;
      return of(calls);
    };

    const first = cache.dedupe('key', source);
    const second = cache.dedupe('key', source);
    expect(first).toBe(second);
  });

  it('does not deduplicate calls with different keys', () => {
    const a = cache.dedupe('a', () => of(1));
    const b = cache.dedupe('b', () => of(2));
    expect(a).not.toBe(b);
  });
});

describe('buildCacheKey', () => {
  it('produces identical keys for equivalent params regardless of insertion order', () => {
    const a = buildCacheKey({
      method: 'GET',
      url: '/posts',
      params: new HttpParams().set('a', '1').set('b', '2'),
    });
    const b = buildCacheKey({
      method: 'GET',
      url: '/posts',
      params: new HttpParams().set('b', '2').set('a', '1'),
    });
    expect(a).toBe(b);
  });

  it('produces different keys for different URLs', () => {
    const a = buildCacheKey({ method: 'GET', url: '/posts', params: new HttpParams() });
    const b = buildCacheKey({ method: 'GET', url: '/users', params: new HttpParams() });
    expect(a).not.toBe(b);
  });

  it('produces different keys for different HTTP methods', () => {
    const a = buildCacheKey({ method: 'GET', url: '/posts', params: new HttpParams() });
    const b = buildCacheKey({ method: 'POST', url: '/posts', params: new HttpParams() });
    expect(a).not.toBe(b);
  });

  it('produces different keys for different bodies', () => {
    const a = buildCacheKey({
      method: 'POST',
      url: '/posts',
      params: new HttpParams(),
      body: { a: 1 },
    });
    const b = buildCacheKey({
      method: 'POST',
      url: '/posts',
      params: new HttpParams(),
      body: { a: 2 },
    });
    expect(a).not.toBe(b);
  });
});
