---
name: ng-ql
description: Reference for building Angular apps with the ng-ql library — an Eloquent-inspired HTTP request and query builder built on HttpClient, Signals, and RxJS. It is NOT an ORM. Use this skill whenever a project imports from "ng-ql", asks to define or extend an NgQlResource, wants a query built with where/whereIn/whereBetween/with/orderBy/paginate, needs Signal-based state (getSignal/firstSignal/paginateSignal), wants CRUD (create/update/patch/destroy) with automatic cache invalidation, needs to pick a cache policy (no-store/cache-first/network-first/stale-while-revalidate), wants provideNgQl set up, or is debugging why an ng-ql resource/query/cache isn't behaving as expected. Always consult this before guessing ng-ql's API from memory — the query builder's immutability, the Observable/Signal split, and the cache-policy semantics are specific to this library, not generic Angular/HttpClient behavior.
---

# ng-ql

An Eloquent-inspired HTTP request and query builder for Angular. **It is not an ORM** — no
database, no models, no identity map, no change tracking. It only builds, serializes, executes,
types, and caches HTTP requests against a REST API, using `HttpClient`, Signals, and RxJS.

Package: `ng-ql` on npm. Peer deps: `@angular/core`, `@angular/common`, `rxjs`. Angular 21+.

Full reference: `llms.txt` at the repo root (or https://hkarimi561.github.io/ng-ql/llms.txt) has
the complete API surface in one file. This skill covers the same ground, organized by task.

## Before writing any ng-ql code

1. Check whether `provideNgQl(...)` is already registered (usually in `app.config.ts` /
   `main.ts`, alongside `provideHttpClient()`). If missing, injecting `NgQlClient` or any
   `NgQlResource` subclass will fail at runtime — add the provider first.
2. Check whether a resource class for the target endpoint already exists under something like
   `*/resources/*.ts` or `*-resource.ts` before creating a new one.
3. Never invent request/response shapes — read the target model interface and the resource's
   `NgQlResourceConfig` (endpoint, `mapItem`/`mapCollection`/`mapPaginated` overrides) if present.

## Task: register the provider

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideNgQl } from 'ng-ql';

providers: [
  provideHttpClient(),
  provideNgQl({
    baseUrl: 'https://api.example.com/v1',
    defaultHeaders: { Accept: 'application/json' },
    defaultCachePolicy: 'no-store',   // applies only to *Signal reads that don't specify one
    defaultCacheTtl: 60_000,
  }),
],
```

`baseUrl` + a relative endpoint are joined without duplicate/missing slashes. An endpoint that
already starts with `http://`, `https://`, or `//` is absolute and is never prefixed.

## Task: define a new resource

A model is a plain `interface`. A resource extends `NgQlResource<TModel, TId>` and takes
`NgQlClient` through **constructor injection** (not `inject()`) so it can forward it to `super()`:

```ts
export interface Post {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
}

@Injectable({ providedIn: 'root' })
export class PostResource extends NgQlResource<Post, number> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'posts', cacheTags: ['posts'] });
  }
}
```

Do not "modernize" this constructor to `inject()` — plain constructor injection is required here
so the parameter can be forwarded to `super(client, config)`.

`NgQlResourceConfig` fields worth knowing: `endpoint` (required), `primaryKey`, `mapItem` /
`mapCollection` / `mapPaginated` (override the global response adapter for just this resource),
`buildUrl`, `requestOptions`, `headers`, `cacheTags`.

## Task: build a query (Observable)

Every chain method returns a **new** builder — nothing is mutated, and **no HTTP request fires
until an execution method is called**.

```ts
this.posts
  .query()
  .where('status', 'published')        // shorthand: (field, value) => equality
  .where('price', '>=', 100)            // explicit: (field, operator, value)
  .whereIn('categoryId', [1, 2])
  .whereNotIn('authorId', [9])
  .whereNull('deletedAt')
  .whereNotNull('publishedAt')
  .whereBetween('price', [10, 20])
  .when(isAdmin, (q) => q.where('status', 'draft'))
  .select(['id', 'title'])
  .with('author')                       // or with(['author', 'comments'])
  .orderBy('createdAt', 'desc')         // or latest('createdAt') / oldest('createdAt')
  .limit(10)
  .page(2, 20)
  .get()                                 // Observable<TModel[]>
  .subscribe((posts) => ...);
```

Operators for the explicit `where(field, operator, value)` form:
`'=' | '!=' | '<>' | '>' | '>=' | '<' | '<=' | 'like' | 'not like'`.

Other execution methods: `.first(options?)` → `Observable<TModel | null>` (null, not a throw, on
empty); `.paginate(page?, perPage?, options?)` → `Observable<NgQlPaginatedResponse<TModel>>`;
`.find(id, options?)` → `Observable<TModel | null>`.

Invalid input (negative `limit`/`offset`, `page`/`perPage` < 1, `NaN`, a bad operator string)
throws `NgQlValidationError` **synchronously at the chain call**, before any request.

## Task: build a query with Signal state

Same chain, but end with `.getSignal(options?)`, `.firstSignal(options?)`, or
`.paginateSignal(page?, perPage?, options?)`. **These call `inject(DestroyRef)` internally, so
they must run in an injection context** — a field initializer, a constructor, or inside
`runInInjectionContext(...)`. Calling one from a click handler or a plain method body will throw.

```ts
export class PostListComponent {
  private readonly posts = inject(PostResource);

  // ✅ field initializer — correct
  protected readonly postsState = this.posts
    .query()
    .where('status', 'published')
    .orderBy('createdAt', 'desc')
    .getSignal({ cache: 'stale-while-revalidate', cacheTtl: 30_000 });

  protected readonly page = this.posts.query().paginateSignal(1, 10);
}
```

In the template: `postsState.data()`, `.loading()`, `.error()`, `.status()` (`'idle' | 'loading' |
'success' | 'error'`), `.hasData()`. All are read-only signals. `postsState.refresh()` re-executes
(bypassing the `cache-first` shortcut, still updates the cache); `postsState.invalidate()` drops
the cache entry and resets to `'idle'`. For paginated state, also `.meta()`, `.links()`,
`.setPage(n)`, `.setPerPage(n)`.

**A plain `.get()`/`.first()`/`.paginate()` (Observable) call never touches the cache.** Caching
only applies to the `*Signal` methods, via `NgQlSignalRequestOptions` (`cache`, `cacheTtl`,
`cacheKey`, `cacheTags`).

## Task: choose a cache policy

| Policy | When to use it |
| --- | --- |
| `'no-store'` (default) | Data that must always be fresh; no caching behavior at all. |
| `'cache-first'` | Rarely-changing reference data — show cached instantly, only fetch if missing/expired. |
| `'network-first'` | Prefer freshness but tolerate showing stale data if the network fails. |
| `'stale-while-revalidate'` | Instant perceived load — show cache immediately, refresh in the background. |

Cache keys are deterministic (method + URL + normalized params/headers/body, order-independent),
so equivalent query chains built in a different method-call order still hit the same cache entry.
Concurrent identical in-flight `GET`s are deduplicated regardless of policy.

## Task: create / update / patch / delete

```ts
this.posts.create({ title: 'New post', status: 'draft' }).subscribe();
this.posts.update(1, { title: 'Replaces the whole record' }).subscribe();  // PUT
this.posts.patch(1, { status: 'published' }).subscribe();                  // PATCH
this.posts.destroy(1).subscribe();                                         // DELETE
```

Every successful mutation **automatically invalidates** cache entries owned by that resource's
endpoint plus its configured `cacheTags` — do not add manual `NgQlCacheService.invalidate*` calls
after a mutation unless invalidating something in a *different* resource/tag.

## Task: test against ng-ql

Use `HttpTestingController`, exactly as with plain `HttpClient`:

```ts
TestBed.configureTestingModule({
  providers: [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideNgQl({ baseUrl: '/api' }),
    PostResource,
  ],
});
const httpMock = TestBed.inject(HttpTestingController);
const posts = TestBed.inject(PostResource);

posts.all().subscribe();
httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'Hello' }]);
httpMock.verify();
```

Call `*Signal` methods inside `TestBed.runInInjectionContext(() => ...)` in tests.

## Anti-patterns — flag or fix these on sight

- Treating `NgQlResource`/a model interface as an ORM entity (`.save()`, identity maps, dirty
  tracking) — none of that exists. It's a typed HTTP façade only.
- Calling a `*Signal` method outside an injection context.
- Expecting `.get()`/`.first()`/`.paginate()` (Observable) to be cached.
- Mutating a query builder in place / discarding the return value of a chain call:
  `query.where('x', 1); query.get()` does nothing — must be `query = query.where('x', 1)`.
- Assuming `.first()` throws or errors on an empty result set — it resolves to `null`.
- Hand-building query strings instead of using `where*`/`select`/`with`/`orderBy`/`page` — this
  bypasses the configured `NgQlQuerySerializer` and breaks if the backend convention changes.
- Rewriting `NgQlResource` subclass constructors to use `inject()` — they need the client as a
  constructor parameter specifically so it can be forwarded via `super(client, config)`.

## Where to look for more

- `llms.txt` (repo root) — complete flat reference, including the default query-serializer's
  exact wire format and the response shapes the default adapter accepts.
- `projects/ng-ql/README.md` — full prose docs with a complete API table.
- The live showcase (https://hkarimi561.github.io/ng-ql/) has a "Help / Install" tab and three
  complete example components with real, runnable model/service/component source.
