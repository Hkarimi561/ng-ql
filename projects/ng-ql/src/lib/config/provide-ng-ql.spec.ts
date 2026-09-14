import { HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { provideNgQl } from './provide-ng-ql';
import { NgQlClient } from '../client/ng-ql-client';
import type { NgQlQuerySerializer } from '../serializers/query-serializer';
import type { NgQlResponseAdapter } from '../adapters/response-adapter';
import { PostResource } from '../testing/test-post-resource';

describe('provideNgQl', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('applies documented defaults when not overridden', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({ baseUrl: '/api' }),
      ],
    });
    const client = TestBed.inject(NgQlClient);
    expect(client.config.defaultCachePolicy).toBe('no-store');
    expect(client.config.defaultCacheTtl).toBe(60_000);
    expect(client.config.baseUrl).toBe('/api');
  });

  it('allows overriding withCredentials and defaultCacheTtl', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({
          baseUrl: '/api',
          withCredentials: true,
          defaultCacheTtl: 5_000,
          defaultCachePolicy: 'cache-first',
        }),
      ],
    });
    const client = TestBed.inject(NgQlClient);
    expect(client.config.withCredentials).toBe(true);
    expect(client.config.defaultCacheTtl).toBe(5_000);
    expect(client.config.defaultCachePolicy).toBe('cache-first');
  });

  it('accepts a fully custom query serializer', async () => {
    const customSerializer: NgQlQuerySerializer = {
      serialize: () => new HttpParams().set('custom', '1'),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({ baseUrl: '/api', querySerializer: customSerializer }),
        PostResource,
      ],
    });
    const posts = TestBed.inject(PostResource);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = firstValueFrom(posts.query().where('status', 'published').get());
    const req = httpMock.expectOne((r) => r.url === '/api/posts');
    expect(req.request.params.get('custom')).toBe('1');
    expect(req.request.params.has('filter[status]')).toBe(false);
    req.flush([]);
    await promise;
    httpMock.verify();
  });

  it('accepts a fully custom response adapter', async () => {
    const customAdapter: NgQlResponseAdapter = {
      adaptCollection: () => [{ id: 999, title: 'from-custom-adapter' }] as never,
      adaptItem: () => null,
      adaptPaginated: () => ({ data: [], meta: { currentPage: 1, perPage: 0, total: 0 } }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({ baseUrl: '/api', responseAdapter: customAdapter }),
        PostResource,
      ],
    });
    const posts = TestBed.inject(PostResource);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = firstValueFrom(posts.all());
    httpMock.expectOne('/api/posts').flush({ anything: true });
    await expect(promise).resolves.toEqual([{ id: 999, title: 'from-custom-adapter' }]);
    httpMock.verify();
  });
});
