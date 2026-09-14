import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideNgQl } from '../config/provide-ng-ql';
import { NgQlClient } from '../client/ng-ql-client';
import { NgQlCacheService } from '../cache/ng-ql-cache.service';
import { NgQlValidationError } from '../errors/ng-ql-validation-error';
import { PostResource, WidgetResource } from '../testing/test-post-resource';

describe('NgQlResource + NgQlQueryBuilder (integration)', () => {
  let httpMock: HttpTestingController;
  let posts: PostResource;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({ baseUrl: '/api', defaultHeaders: { Accept: 'application/json' } }),
        PostResource,
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    posts = TestBed.inject(PostResource);
  });

  afterEach(() => httpMock.verify());

  // -----------------------------------------------------------------------
  // URL joining
  // -----------------------------------------------------------------------

  it('joins a relative endpoint onto the configured base URL', () => {
    posts.all().subscribe();
    const req = httpMock.expectOne('/api/posts');
    req.flush([]);
  });

  it('does not prefix an absolute resource endpoint with the base URL', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgQl({ baseUrl: '/api' }),
      ],
    });
    const client2 = TestBed.inject(NgQlClient);
    expect(client2.resolveUrl('https://other.example.com/posts')).toBe(
      'https://other.example.com/posts',
    );
    TestBed.inject(HttpTestingController).verify();
  });

  // -----------------------------------------------------------------------
  // Query builder immutability & chaining
  // -----------------------------------------------------------------------

  it('never mutates a previous builder instance when chaining', () => {
    const base = posts.query();
    const withWhere = base.where('status', 'published');
    expect(base.toUrl()).toBe('/api/posts');
    expect(withWhere.toUrl()).toBe('/api/posts?filter[status]=published');
    expect(base).not.toBe(withWhere);
  });

  it('supports the equality shorthand and explicit operators together', () => {
    const url = posts.query().where('status', 'published').where('price', '>=', 100).toUrl();
    expect(url).toContain('filter[status]=published');
    expect(url).toContain('filter[price][gte]=100');
  });

  it('supports whereIn, whereNotIn, whereNull, whereNotNull, whereBetween together', () => {
    const params = posts
      .query()
      .whereIn('categoryId', [1, 2])
      .whereNotIn('authorId', [9])
      .whereNull('deletedAt')
      .whereNotNull('publishedAt')
      .whereBetween('price', [10, 20])
      .toQueryParams();

    expect(params.getAll('filter[categoryId][]')).toEqual(['1', '2']);
    expect(params.getAll('filter[authorId][not_in][]')).toEqual(['9']);
    expect(params.get('filter[deletedAt]')).toBe('null');
    expect(params.get('filter[publishedAt][ne]')).toBe('null');
    expect(params.get('filter[price][between]')).toBe('10,20');
  });

  it('accepts an object form of where(), AND-ing every entry together', () => {
    const params = posts.query().where({ title: 'Hello', status: 'published' }).toQueryParams();
    expect(params.get('filter[title]')).toBe('Hello');
    expect(params.get('filter[status]')).toBe('published');
    // No orWhere was used, so it stays a single flat group (no filter[or][...]).
    expect(params.has('filter[or][0][title]')).toBe(false);
  });

  it('orWhere() ORs a new condition against the existing chain', () => {
    const url = posts.query().where('status', 'published').orWhere('featured', true).toUrl();
    expect(url).toContain('filter[or][0][status]=published');
    expect(url).toContain('filter[or][1][featured]=true');
  });

  it('orWhere() accepts an object form too, AND-ing its own entries', () => {
    const params = posts
      .query()
      .where('status', 'published')
      .orWhere({ title: 'Hello', authorId: 1 })
      .toQueryParams();

    expect(params.get('filter[or][0][status]')).toBe('published');
    expect(params.get('filter[or][1][title]')).toBe('Hello');
    expect(params.get('filter[or][1][authorId]')).toBe('1');
  });

  it('does not mutate the receiver when chaining orWhere()', () => {
    const base = posts.query().where('status', 'published');
    const withOr = base.orWhere('featured', true);
    expect(base.toUrl()).not.toContain('filter[or]');
    expect(withOr.toUrl()).toContain('filter[or]');
    expect(base).not.toBe(withOr);
  });

  it('applies when() only if the condition is true, without mutating the receiver', () => {
    const includeDrafts = false;
    const query = posts.query().when(includeDrafts, (q) => q.where('status', 'draft'));
    expect(query.toUrl()).toBe('/api/posts');

    const query2 = posts.query().when(true, (q) => q.where('status', 'draft'));
    expect(query2.toUrl()).toContain('filter[status]=draft');
  });

  it('serializes select(), with(), orderBy(), limit(), and page() together', () => {
    const url = posts
      .query()
      .select(['id', 'title'])
      .with(['author', 'comments'])
      .orderBy('createdAt', 'desc')
      .limit(10)
      .toUrl();
    expect(url).toContain('fields=id%2Ctitle');
    expect(url).toContain('include=author%2Ccomments');
    expect(url).toContain('sort=-createdAt');
    expect(url).toContain('page[size]=10');
  });

  it('page(2, 20) sets both page number and size', () => {
    const url = posts.query().page(2, 20).toUrl();
    expect(url).toContain('page[number]=2');
    expect(url).toContain('page[size]=20');
  });

  it('latest()/oldest() are shorthand for orderBy desc/asc', () => {
    expect(posts.query().latest('createdAt').toUrl()).toContain('sort=-createdAt');
    expect(posts.query().oldest('createdAt').toUrl()).toContain('sort=createdAt');
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  it('throws before any HTTP request for a negative limit', () => {
    expect(() => posts.query().limit(-1)).toThrow(NgQlValidationError);
    httpMock.expectNone('/api/posts');
  });

  it('throws for a negative offset', () => {
    expect(() => posts.query().offset(-1)).toThrow(NgQlValidationError);
  });

  it('throws for a page number below 1', () => {
    expect(() => posts.query().page(0)).toThrow(NgQlValidationError);
  });

  it('throws for a per-page value below 1', () => {
    expect(() => posts.query().perPage(0)).toThrow(NgQlValidationError);
  });

  it('throws for NaN limits', () => {
    expect(() => posts.query().limit(Number.NaN)).toThrow(NgQlValidationError);
  });

  it('throws for an unrecognized explicit operator', () => {
    expect(() => posts.query().where('price', 'weird-op' as never, 100)).toThrow(
      NgQlValidationError,
    );
  });

  // -----------------------------------------------------------------------
  // Response adapters
  // -----------------------------------------------------------------------

  it('adapts a raw array response for get()', async () => {
    const promise = firstValueFrom(posts.all());
    httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'A' }]);
    await expect(promise).resolves.toEqual([{ id: 1, title: 'A' }]);
  });

  it('adapts a data-wrapped collection response', async () => {
    const promise = firstValueFrom(posts.all());
    httpMock.expectOne('/api/posts').flush({ data: [{ id: 1, title: 'A' }] });
    await expect(promise).resolves.toEqual([{ id: 1, title: 'A' }]);
  });

  it('returns null from first() when the collection is empty', async () => {
    const promise = firstValueFrom(posts.first());
    httpMock.expectOne((r) => r.url === '/api/posts').flush([]);
    await expect(promise).resolves.toBeNull();
  });

  it('adapts a paginated response into normalized meta/links', async () => {
    const promise = firstValueFrom(posts.query().paginate(1, 10));
    httpMock
      .expectOne((r) => r.url === '/api/posts')
      .flush({
        data: [{ id: 1, title: 'A' }],
        meta: { current_page: 1, last_page: 4, per_page: 10, total: 40 },
        links: { first: 'a', last: 'b', prev: null, next: 'c' },
      });
    const result = await promise;
    expect(result.meta).toEqual({ currentPage: 1, lastPage: 4, perPage: 10, total: 40 });
    expect(result.links).toEqual({ first: 'a', last: 'b', prev: null, next: 'c' });
  });

  // -----------------------------------------------------------------------
  // Header precedence
  // -----------------------------------------------------------------------

  it('merges headers with per-request options overriding builder, resource, and global defaults', () => {
    posts
      .query()
      .setHeaders({ 'X-Builder': 'builder-value', Accept: 'text/builder' })
      .get({ headers: { Accept: 'text/request' } })
      .subscribe();

    const req = httpMock.expectOne('/api/posts');
    expect(req.request.headers.get('X-Builder')).toBe('builder-value');
    expect(req.request.headers.get('Accept')).toBe('text/request');
    req.flush([]);
  });

  it('falls back to global default headers when nothing overrides them', () => {
    posts.all().subscribe();
    const req = httpMock.expectOne('/api/posts');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush([]);
  });

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  it('creates via POST and returns the decoded item', async () => {
    const promise = firstValueFrom(posts.create({ title: 'New' }));
    const req = httpMock.expectOne('/api/posts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'New' });
    req.flush({ data: { id: 1, title: 'New' } });
    await expect(promise).resolves.toEqual({ id: 1, title: 'New' });
  });

  it('updates via PUT', async () => {
    const promise = firstValueFrom(posts.update(1, { title: 'Updated' }));
    const req = httpMock.expectOne('/api/posts/1');
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 1, title: 'Updated' });
    await expect(promise).resolves.toEqual({ id: 1, title: 'Updated' });
  });

  it('patches via PATCH', async () => {
    const promise = firstValueFrom(posts.patch(1, { title: 'Patched' }));
    const req = httpMock.expectOne('/api/posts/1');
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 1, title: 'Patched' });
    await expect(promise).resolves.toEqual({ id: 1, title: 'Patched' });
  });

  it('destroys via DELETE and resolves void', async () => {
    const promise = firstValueFrom(posts.destroy(1));
    const req = httpMock.expectOne('/api/posts/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await expect(promise).resolves.toBeUndefined();
  });

  it('finds a single item by id', async () => {
    const promise = firstValueFrom(posts.find(1));
    httpMock.expectOne('/api/posts/1').flush({ id: 1, title: 'A' });
    await expect(promise).resolves.toEqual({ id: 1, title: 'A' });
  });

  // -----------------------------------------------------------------------
  // Error propagation
  // -----------------------------------------------------------------------

  it('propagates HttpErrorResponse details on failure', async () => {
    const promise = firstValueFrom(posts.all());
    httpMock
      .expectOne('/api/posts')
      .flush('Server error', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  // -----------------------------------------------------------------------
  // Cache invalidation after mutations
  // -----------------------------------------------------------------------

  it('invalidates cache entries for the resource endpoint after a successful mutation', async () => {
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('fake-posts-key', ['stale'], { ttl: 60_000, endpoint: 'posts' });
    expect(cache.get('fake-posts-key')).toBeDefined();

    const promise = firstValueFrom(posts.create({ title: 'New' }));
    httpMock.expectOne('/api/posts').flush({ data: { id: 1, title: 'New' } });
    await promise;

    expect(cache.get('fake-posts-key')).toBeUndefined();
  });

  it('invalidates cache tags after a successful mutation', async () => {
    const cache = TestBed.inject(NgQlCacheService);
    cache.set('fake-key', ['stale'], { ttl: 60_000, tags: ['posts'] });

    const promise = firstValueFrom(posts.destroy(1));
    httpMock.expectOne('/api/posts/1').flush(null);
    await promise;

    expect(cache.get('fake-key')).toBeUndefined();
  });

  it('does not cache mutations themselves', async () => {
    const cache = TestBed.inject(NgQlCacheService);
    const promise = firstValueFrom(posts.create({ title: 'New' }));
    httpMock.expectOne('/api/posts').flush({ data: { id: 1, title: 'New' } });
    await promise;
    // A mutation must never be stored as a readable cache entry under any key.
    expect(cache.get('POST::/api/posts')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getId()
  // -----------------------------------------------------------------------

  it('getId() reads the "id" property by default', () => {
    expect(posts.getId({ id: 42, title: 'A' })).toBe(42);
  });

  it('getId() honors a custom primaryKey from NgQlResourceConfig', () => {
    const widgets = new WidgetResource(TestBed.inject(NgQlClient));
    expect(widgets.getId({ uuid: 'abc-123', name: 'Gadget' })).toBe('abc-123');
  });
});
