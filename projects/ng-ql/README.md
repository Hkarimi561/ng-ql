# ng-ql

An Eloquent-inspired HTTP request and query builder for Angular. **ng-ql is not an ORM** — it manages no database, no models, no identity map. It builds, serializes, executes, types, caches, and exposes HTTP requests against REST APIs using Angular `HttpClient`, Signals, and RxJS.

## Design principles

- **Idiomatic Angular.** Built on `HttpClient`, standalone APIs, `EnvironmentProviders`, Signals, and `DestroyRef`. No custom HTTP stack.
- **Dual API surface.** Every read exposes both an RxJS `Observable` method and a Signal-based `*Signal` method with built-in loading/error/cache state.
- **Immutable query builder.** Every chain method returns a new builder; nothing is ever mutated in place.
- **No surprise requests.** A query builder or resource method never performs an HTTP call until you call an execution method (`get`, `first`, `paginate`, `find`, or a `*Signal`/CRUD equivalent).
- **Pluggable wire format.** The filter/sort/pagination convention and the response envelope are both swappable via `NgQlQuerySerializer` and `NgQlResponseAdapter`.
- **SSR-safe.** No `window`, `document`, or other browser globals anywhere in the library.

## Installation

```bash
npm install ng-ql
```

`ng-ql`'s only runtime dependencies are `@angular/core`, `@angular/common`, and `rxjs` — nothing else is pulled in.

## Provider setup

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideNgQl } from 'ng-ql';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideNgQl({
      baseUrl: 'https://api.example.com/v1',
      defaultHeaders: { Accept: 'application/json' },
      withCredentials: false,
      defaultCachePolicy: 'no-store',
      defaultCacheTtl: 60_000,
    }),
  ],
});
```

`NgQlConfig`:

| Option | Description |
| --- | --- |
| `baseUrl` | Prefix joined onto every relative resource endpoint (no duplicate/missing slashes). Absolute endpoints (`https://…`, `//…`) bypass it entirely. |
| `defaultHeaders` | Headers merged into every request at the lowest precedence. |
| `withCredentials` | Default `withCredentials` for every request. |
| `defaultCachePolicy` | Default `NgQlCachePolicy` for Signal requests that don't specify one. Defaults to `'no-store'`. |
| `defaultCacheTtl` | Default cache TTL (ms). Defaults to `60_000`. |
| `querySerializer` | Custom `NgQlQuerySerializer`. Defaults to `DefaultNgQlQuerySerializer`. |
| `responseAdapter` | Custom `NgQlResponseAdapter`. Defaults to `DefaultNgQlResponseAdapter`. |
| `defaultRequestOptions` | Request options merged into every request. |

## Defining a resource

```ts
import { Injectable } from '@angular/core';
import { NgQlClient, NgQlResource } from 'ng-ql';

export interface Post {
  id: number;
  title: string;
  status: 'draft' | 'published';
}

@Injectable({ providedIn: 'root' })
export class PostResource extends NgQlResource<Post, number> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'posts', cacheTags: ['posts'] });
  }
}
```

`NgQlResourceConfig` also accepts `primaryKey`, `mapItem`/`mapCollection`/`mapPaginated` (per-resource response overrides), `buildUrl`, `requestOptions`, and `headers`.

## Observable API

```ts
this.posts
  .query()
  .where('status', 'published')
  .whereIn('categoryId', [1, 2])
  .with('author')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get()
  .subscribe((posts) => console.log(posts));

this.posts.first().subscribe((post) => console.log(post)); // null if empty
this.posts.find(42).subscribe((post) => console.log(post));
this.posts.query().paginate(2, 20).subscribe((page) => console.log(page.data, page.meta));
```

## Signal API

```ts
@Component({ /* ... */ })
export class PostListComponent {
  private readonly posts = inject(PostResource);

  protected readonly postsState = this.posts
    .query()
    .where('status', 'published')
    .orderBy('createdAt', 'desc')
    .getSignal({ cache: 'stale-while-revalidate', cacheTtl: 30_000 });

  // postsState.data() / .loading() / .error() / .status() / .hasData()
  // postsState.refresh() / postsState.invalidate()
}
```

`getSignal`/`firstSignal`/`findSignal`/`allSignal`/`paginateSignal` all call `inject()` internally, so call them from an injection context (a field initializer, a constructor, or inside `runInInjectionContext`).

```ts
protected readonly page = this.posts.query().paginateSignal(1, 10);
// page.data() / page.meta() / page.links()
// page.setPage(2) / page.setPerPage(25)
```

## Caching policies

| Policy | Behavior |
| --- | --- |
| `no-store` | Always executes the request; never reads or writes the cache. |
| `cache-first` | Returns valid cached data immediately if present; otherwise fetches. |
| `network-first` | Fetches fresh data first; falls back to a cached value if the request fails. |
| `stale-while-revalidate` | Returns cached data immediately (if any) while revalidating in the background. |

Concurrent, identical in-flight `GET` requests are always deduplicated into a single HTTP call, regardless of policy.

Cache keys are deterministic — method, resolved URL, and normalized (order-independent) params/headers/body — so equivalent query builders always hit the same cache entry.

### Invalidation

- `state.invalidate()` drops the cache entry backing that Signal state and resets it to `idle`.
- `state.refresh()` re-executes the request (bypassing the `cache-first` shortcut) and rewrites the cache on success.
- Every successful `create`/`update`/`patch`/`destroy` automatically invalidates cache entries owned by that resource's endpoint, plus any configured `cacheTags`.
- `NgQlCacheService` (injectable, instance-scoped — never global/static state) also exposes `invalidateKey`, `invalidateTag`, `invalidateEndpoint`, and `clear` for manual control.

## CRUD operations

```ts
this.posts.create({ title: 'New post', status: 'draft' }).subscribe();
this.posts.update(1, { title: 'Updated title' }).subscribe();
this.posts.patch(1, { status: 'published' }).subscribe();
this.posts.destroy(1).subscribe();
```

## Custom serializers and response adapters

```ts
import type { NgQlQuerySerializer, NgQlResponseAdapter } from 'ng-ql';

class ODataSerializer implements NgQlQuerySerializer {
  serialize(state) {
    /* build HttpParams however your backend expects */
  }
}

provideNgQl({
  baseUrl: '/api',
  querySerializer: new ODataSerializer(),
  responseAdapter: myResponseAdapter,
});
```

The default serializer's convention:

```text
where('status', 'published')        => filter[status]=published
where('price', '>=', 100)           => filter[price][gte]=100
whereIn('categoryId', [1, 2])       => filter[categoryId][]=1&filter[categoryId][]=2
whereNotIn('categoryId', [1, 2])    => filter[categoryId][not_in][]=1&filter[categoryId][not_in][]=2
whereNull('deletedAt')              => filter[deletedAt]=null
whereNotNull('deletedAt')           => filter[deletedAt][ne]=null
whereBetween('price', [10, 20])     => filter[price][between]=10,20
select(['id', 'title'])             => fields=id,title
with('author')                      => include=author
orderBy('createdAt', 'desc')        => sort=-createdAt
limit(10)                           => page[size]=10
offset(20)                          => page[offset]=20
page(2, 20)                         => page[number]=2&page[size]=20
```

The default response adapter accepts a raw array, a `{ data: [...] }` collection, a `{ data: {...} }` or raw item, and a paginated `{ data, meta, links }` envelope (snake_case or camelCase meta keys).

## Request options and header precedence

Headers are merged in ascending precedence — later sources win on conflicting keys:

1. `NgQlConfig.defaultHeaders`
2. `NgQlResourceConfig.headers`
3. `NgQlQueryBuilder#setHeaders(...)`
4. Per-call `options.headers`

`NgQlRequestOptions` also accepts `params`, `withCredentials`, `context` (`HttpContext`), and `observe: 'body'`.

## Testing with `HttpTestingController`

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNgQl } from 'ng-ql';

TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting(), provideNgQl({ baseUrl: '/api' }), PostResource],
});

const httpMock = TestBed.inject(HttpTestingController);
const posts = TestBed.inject(PostResource);

posts.all().subscribe();
httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'Hello' }]);
httpMock.verify();
```

For Signal APIs, call them inside `TestBed.runInInjectionContext(...)`.

## SSR compatibility

ng-ql never touches `window`, `document`, `localStorage`, or any other browser global. `NgQlCacheService` is a plain in-memory, per-injector store, and all lifecycle cleanup goes through `DestroyRef`, so the library behaves identically during a server-rendered pass and can be safely instantiated once per request.

## API reference

| Export | Kind |
| --- | --- |
| `provideNgQl(config)` | Function — registers global configuration. |
| `NgQlClient` | Injectable — low-level HTTP execution engine. |
| `NgQlResource<TModel, TId>` | Abstract class — typed CRUD + query façade for one endpoint. |
| `NgQlQueryBuilder<TModel, TId>` | Class — immutable fluent query builder. |
| `NgQlCacheService` | Injectable — Signal-request cache. |
| `NgQlValidationError` | Error class — thrown for invalid builder input before any request. |
| `DefaultNgQlQuerySerializer` / `NgQlQuerySerializer` | Query → `HttpParams` serialization. |
| `DefaultNgQlResponseAdapter` / `NgQlResponseAdapter` | Response → model normalization. |
| `NgQlConfig`, `NgQlResourceConfig`, `NgQlRequestOptions`, `NgQlSignalRequestOptions` | Configuration interfaces. |
| `NgQlRequestState<T>`, `NgQlPaginatedRequestState<T>` | Signal-backed request state. |
| `NgQlPaginationMeta`, `NgQlPaginationLinks`, `NgQlPaginatedResponse<T>` | Normalized pagination shapes. |
| `NgQlRequestDescription` | Inspectable request shape from `toRequest()`. |
| `NgQlCachePolicy` | `'no-store' \| 'cache-first' \| 'network-first' \| 'stale-while-revalidate'`. |
| `QueryOperator`, `QueryValue`, `NgQlQueryState` | Query builder primitives. |

### `NgQlQueryBuilder<TModel, TId>`

`where`, `whereIn`, `whereNotIn`, `whereNull`, `whereNotNull`, `whereBetween`, `when`, `select`, `with`, `withQuery`, `append`, `orderBy`, `latest`, `oldest`, `limit`, `offset`, `page`, `perPage`, `setHeaders`, `setOptions` — all immutable chain methods.

`get`, `first`, `paginate`, `find` — Observable execution. `getSignal`, `firstSignal`, `paginateSignal` — Signal execution. `toUrl`, `toQueryParams`, `toRequest` — inspection, no request performed.

### `NgQlResource<TModel, TId>`

`query`, `all`/`allSignal`, `find`/`findSignal`, `first`/`firstSignal`, `create`, `update`, `patch`, `destroy`.
