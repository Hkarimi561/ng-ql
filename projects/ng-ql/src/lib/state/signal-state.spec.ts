import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNgQl } from '../config/provide-ng-ql';
import { NgQlCacheService } from '../cache/ng-ql-cache.service';
import { PostResource } from '../testing/test-post-resource';

describe('Signal-based request state', () => {
  let httpMock: HttpTestingController;
  let posts: PostResource;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({ baseUrl: '/api' }),
        PostResource,
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    posts = TestBed.inject(PostResource);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('transitions idle -> loading -> success', () => {
    const state = TestBed.runInInjectionContext(() =>
      posts.query().where('status', 'published').getSignal(),
    );
    expect(state.status()).toBe('loading');
    expect(state.loading()).toBe(true);

    httpMock.expectOne((r) => r.url === '/api/posts').flush([{ id: 1, title: 'A' }]);

    expect(state.status()).toBe('success');
    expect(state.loading()).toBe(false);
    expect(state.data()).toEqual([{ id: 1, title: 'A' }]);
    expect(state.hasData()).toBe(true);
    expect(state.error()).toBeNull();
  });

  it('transitions idle -> loading -> error on failure with no-store', () => {
    const state = TestBed.runInInjectionContext(() => posts.allSignal({ cache: 'no-store' }));
    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(state.status()).toBe('error');
    expect(state.error()).not.toBeNull();
    expect(state.data()).toBeNull();
  });

  it('cache-first returns cached data immediately without a network request', () => {
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('preset-key', [{ id: 9, title: 'Cached' }], { ttl: 60_000 });

    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'cache-first', cacheKey: 'preset-key' }),
    );

    expect(state.status()).toBe('success');
    expect(state.data()).toEqual([{ id: 9, title: 'Cached' }]);
    httpMock.expectNone('/api/posts');
  });

  it('cache-first fetches from network when no valid cache entry exists', () => {
    const state = TestBed.runInInjectionContext(() => posts.allSignal({ cache: 'cache-first' }));
    expect(state.status()).toBe('loading');
    httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'A' }]);
    expect(state.data()).toEqual([{ id: 1, title: 'A' }]);
  });

  it('network-first falls back to cached data when the network request fails', () => {
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('preset-key', [{ id: 5, title: 'Fallback' }], { ttl: 60_000 });

    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'network-first', cacheKey: 'preset-key' }),
    );
    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(state.data()).toEqual([{ id: 5, title: 'Fallback' }]);
    expect(state.status()).toBe('success');
    expect(state.error()).not.toBeNull();
  });

  it('network-first reports an error when the network fails and no cache exists', () => {
    const state = TestBed.runInInjectionContext(() => posts.allSignal({ cache: 'network-first' }));
    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(state.status()).toBe('error');
    expect(state.data()).toBeNull();
  });

  it('retries with exponential backoff before succeeding, using a single retry sequence', async () => {
    vi.useFakeTimers();
    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'no-store', retry: 2, retryDelay: 100 }),
    );

    // Attempt 1 fails.
    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(state.status()).toBe('loading');

    // First backoff: 100ms.
    await vi.advanceTimersByTimeAsync(100);
    httpMock
      .expectOne('/api/posts')
      .flush('boom again', { status: 500, statusText: 'Server Error' });
    expect(state.status()).toBe('loading');

    // Second backoff: 200ms (doubled).
    await vi.advanceTimersByTimeAsync(200);
    httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'Recovered' }]);

    expect(state.status()).toBe('success');
    expect(state.data()).toEqual([{ id: 1, title: 'Recovered' }]);
  });

  it('gives up after exhausting retries and falls back to cache (network-first)', async () => {
    vi.useFakeTimers();
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('preset-key', [{ id: 9, title: 'Fallback' }], { ttl: 60_000 });

    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'network-first', cacheKey: 'preset-key', retry: 1, retryDelay: 50 }),
    );

    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });
    await vi.advanceTimersByTimeAsync(50);
    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(state.status()).toBe('success');
    expect(state.data()).toEqual([{ id: 9, title: 'Fallback' }]);
    expect(state.error()).not.toBeNull();
  });

  it('does not retry by default (retry defaults to 0)', () => {
    const state = TestBed.runInInjectionContext(() => posts.allSignal({ cache: 'no-store' }));
    httpMock.expectOne('/api/posts').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(state.status()).toBe('error');
  });

  it('stale-while-revalidate serves cached data immediately, then updates after revalidation', () => {
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('preset-key', [{ id: 1, title: 'Stale' }], { ttl: 60_000 });

    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'stale-while-revalidate', cacheKey: 'preset-key' }),
    );

    expect(state.data()).toEqual([{ id: 1, title: 'Stale' }]);

    httpMock.expectOne('/api/posts').flush([{ id: 2, title: 'Fresh' }]);

    expect(state.data()).toEqual([{ id: 2, title: 'Fresh' }]);
    expect(state.status()).toBe('success');
  });

  it('respects TTL expiration for cache-first', () => {
    vi.useFakeTimers();
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('preset-key', [{ id: 1, title: 'Old' }], { ttl: 10 });
    vi.advanceTimersByTime(20);

    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'cache-first', cacheKey: 'preset-key' }),
    );
    expect(state.status()).toBe('loading');
    httpMock.expectOne('/api/posts').flush([{ id: 2, title: 'New' }]);
    expect(state.data()).toEqual([{ id: 2, title: 'New' }]);
  });

  it('refresh() re-executes the request and updates the cache', () => {
    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'cache-first', cacheKey: 'k' }),
    );
    httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'A' }]);
    expect(state.data()).toEqual([{ id: 1, title: 'A' }]);

    state.refresh();
    httpMock.expectOne('/api/posts').flush([{ id: 2, title: 'B' }]);
    expect(state.data()).toEqual([{ id: 2, title: 'B' }]);
  });

  it('invalidate() clears the cache entry and resets state to idle', () => {
    const cache = TestBed.inject(NgQlCacheService);
    const state = TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'cache-first', cacheKey: 'k' }),
    );
    httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'A' }]);

    state.invalidate();

    expect(state.status()).toBe('idle');
    expect(state.data()).toBeNull();
    expect(cache.get('k')).toBeUndefined();
  });

  it('deduplicates two concurrent identical getSignal() calls into a single HTTP request', () => {
    TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'no-store', cacheKey: 'dedupe-key' }),
    );
    TestBed.runInInjectionContext(() =>
      posts.allSignal({ cache: 'no-store', cacheKey: 'dedupe-key' }),
    );

    httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'A' }]);
    httpMock.verify();
  });

  it('paginateSignal exposes meta/links and supports setPage/setPerPage', () => {
    const state = TestBed.runInInjectionContext(() => posts.query().paginateSignal(1, 10));
    httpMock
      .expectOne((r) => r.url === '/api/posts')
      .flush({
        data: [{ id: 1, title: 'A' }],
        meta: { current_page: 1, last_page: 3, per_page: 10, total: 30 },
      });
    expect(state.meta()).toEqual({ currentPage: 1, lastPage: 3, perPage: 10, total: 30 });

    state.setPage(2);
    const req = httpMock.expectOne((r) => r.url === '/api/posts');
    expect(req.request.params.get('page[number]')).toBe('2');
    req.flush({
      data: [{ id: 11, title: 'B' }],
      meta: { current_page: 2, last_page: 3, per_page: 10, total: 30 },
    });
    expect(state.data()).toEqual([{ id: 11, title: 'B' }]);
  });

  it('cleans up its subscription when its injector is destroyed, ignoring late responses', () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const child = createEnvironmentInjector([], parent);
    const postsInChild = child.get(PostResource);

    const state = runInInjectionContext(child, () => postsInChild.allSignal({ cache: 'no-store' }));
    expect(state.status()).toBe('loading');

    // Destroying the injector must unsubscribe; the pending HTTP request is
    // cancelled outright as a result, so it never needs (or accepts) a flush.
    // `match()` drains it from the pending-request queue without flushing it.
    child.destroy();
    httpMock.match(() => true);

    expect(state.data()).toBeNull();
    expect(state.status()).toBe('loading');
  });
});
