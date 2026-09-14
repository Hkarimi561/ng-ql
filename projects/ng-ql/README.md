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

| Option                  | Description                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`               | Prefix joined onto every relative resource endpoint (no duplicate/missing slashes). Absolute endpoints (`https://…`, `//…`) bypass it entirely. |
| `defaultHeaders`        | Headers merged into every request at the lowest precedence.                                                                                     |
| `withCredentials`       | Default `withCredentials` for every request.                                                                                                    |
| `defaultCachePolicy`    | Default `NgQlCachePolicy` for Signal requests that don't specify one. Defaults to `'no-store'`.                                                 |
| `defaultCacheTtl`       | Default cache TTL (ms). Defaults to `60_000`.                                                                                                   |
| `querySerializer`       | Custom `NgQlQuerySerializer`. Defaults to `DefaultNgQlQuerySerializer`.                                                                         |
| `responseAdapter`       | Custom `NgQlResponseAdapter`. Defaults to `DefaultNgQlResponseAdapter`.                                                                         |
| `defaultRequestOptions` | Request options merged into every request.                                                                                                      |

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
this.posts
  .query()
  .paginate(2, 20)
  .subscribe((page) => console.log(page.data, page.meta));
```

## Signal API

```ts
@Component({/* ... */})
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

`setPage`/`setPerPage` _replace_ `data`. For infinite-scroll / "load more" UIs, use `loadMore()` instead — it fetches the next page and _appends_ to the existing array:

```ts
protected readonly feed = this.posts.query().orderBy('createdAt', 'desc').paginateSignal(1, 20);

// In the template: @for (post of feed.data(); ...) { ... }
// A "Load more" button:
//   [disabled]="!feed.hasMore() || feed.loadingMore()"
//   (click)="feed.loadMore()"
```

`hasMore()` reflects whether another page exists past the currently-loaded one; `loadingMore()` is `true` only while a `loadMore()` fetch is in flight (distinct from `loading()`, which covers `setPage`/`setPerPage`/`refresh`). A failed `loadMore()` leaves the already-loaded pages in place and just surfaces the error via `.error()`.

### Optimistic updates

Every Signal state — `NgQlRequestState` and `NgQlPaginatedRequestState` alike — has `mutateOptimistically(updater, commit)`: it applies `updater` to the current data immediately, then subscribes to `commit()`. On success the optimistic value stays; on error, the previous value/status are restored and the error surfaces via `.error()`.

```ts
// Optimistic delete:
postsState.mutateOptimistically(
  (posts) => (posts ?? []).filter((p) => p.id !== id),
  () => this.posts.destroy(id),
);

// Optimistic patch:
postsState.mutateOptimistically(
  (posts) => (posts ?? []).map((p) => (p.id === id ? { ...p, ...payload } : p)),
  () => this.posts.patch(id, payload),
);
```

It doesn't touch the cache directly — a mutation's own cache invalidation (see [Invalidation](#invalidation) below) already governs what a later `refresh()` sees.

## Caching policies

| Policy                   | Behavior                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| `no-store`               | Always executes the request; never reads or writes the cache.                  |
| `cache-first`            | Returns valid cached data immediately if present; otherwise fetches.           |
| `network-first`          | Fetches fresh data first; falls back to a cached value if the request fails.   |
| `stale-while-revalidate` | Returns cached data immediately (if any) while revalidating in the background. |

Concurrent, identical in-flight `GET` requests are always deduplicated into a single HTTP call, regardless of policy.

Cache keys are deterministic — method, resolved URL, and normalized (order-independent) params/headers/body — so equivalent query builders always hit the same cache entry.

### Retries

Every Signal request accepts `retry` (max attempts, default `0` — disabled) and `retryDelay` (base delay in ms, default `300`) on `NgQlSignalRequestOptions`. Retries use exponential backoff (`retryDelay * 2^(attempt - 1)`) and happen _before_ a policy's fallback/error behavior — most useful with `network-first`, so a couple of quick retries can recover from a blip before falling back to cache:

```ts
this.posts.query().getSignal({ cache: 'network-first', retry: 2, retryDelay: 300 });
// attempt 1 fails -> wait 300ms -> attempt 2 fails -> wait 600ms -> attempt 3
// succeeds, or falls back to cache / errors if it also fails.
```

Concurrent identical requests share one retry sequence — retrying doesn't multiply outstanding HTTP calls.

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

where('status', 'published').orWhere('featured', true)
                                     => filter[or][0][status]=published&filter[or][1][featured]=true
```

The `filter[...]` wrapper is optional — pass `filterPrefix: null` (or any other string) to `DefaultNgQlQuerySerializer` for backends that expect bare field names instead:

```ts
provideNgQl({
  baseUrl: '/api',
  querySerializer: new DefaultNgQlQuerySerializer({ filterPrefix: null }),
});

// where('id', 1122)                          => id=1122
// where('status', 'published').orWhere(...)  => or[0][status]=published&or[1][...]
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

For Signal APIs, call them inside `TestBed.runInInjectionContext(...)`.

## SSR compatibility

ng-ql never touches `window`, `document`, `localStorage`, or any other browser global. `NgQlCacheService` is a plain in-memory, per-injector store, and all lifecycle cleanup goes through `DestroyRef`, so the library behaves identically during a server-rendered pass and can be safely instantiated once per request.

## AI-assisted development

This repo ships an [`llms.txt`](../../llms.txt) at the root — a complete, flat reference to ng-ql's API (also served live at https://hkarimi561.github.io/ng-ql/llms.txt) — for feeding into an LLM's context or an AI coding tool that supports the [llms.txt convention](https://llmstxt.org/).

If you use [Claude Code](https://claude.com/claude-code), there's also a ready-made skill at [`.claude/skills/ng-ql/`](../../.claude/skills/ng-ql/SKILL.md). Copy that folder into your own project's `.claude/skills/` directory and Claude will automatically ground its ng-ql code generation and debugging in this library's actual API and conventions (immutable query builder, the Observable/Signal split, cache-policy semantics, etc.) instead of guessing from generic Angular/HttpClient patterns.

## API reference

| Export                                                                               | Kind                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `provideNgQl(config)`                                                                | Function — registers global configuration.                                    |
| `NgQlClient`                                                                         | Injectable — low-level HTTP execution engine.                                 |
| `NgQlResource<TModel, TId>`                                                          | Abstract class — typed CRUD + query façade for one endpoint.                  |
| `NgQlQueryBuilder<TModel, TId>`                                                      | Class — immutable fluent query builder.                                       |
| `NgQlCacheService`                                                                   | Injectable — Signal-request cache.                                            |
| `NgQlValidationError`                                                                | Error class — thrown for invalid builder input before any request.            |
| `DefaultNgQlQuerySerializer` / `NgQlQuerySerializer`                                 | Query → `HttpParams` serialization. Accepts `DefaultNgQlQuerySerializerOptions` (`filterPrefix`). |
| `DefaultNgQlResponseAdapter` / `NgQlResponseAdapter`                                 | Response → model normalization.                                               |
| `NgQlConfig`, `NgQlResourceConfig`, `NgQlRequestOptions`, `NgQlSignalRequestOptions` | Configuration interfaces.                                                     |
| `NgQlEndpoint` / `NgQlEndpointOptions`                                               | Method decorator — per-method URL/HTTP-method/id-placement override.         |
| `NgQlRequestState<T>`, `NgQlPaginatedRequestState<T>`                                | Signal-backed request state.                                                  |
| `NgQlPaginationMeta`, `NgQlPaginationLinks`, `NgQlPaginatedResponse<T>`              | Normalized pagination shapes.                                                 |
| `NgQlRequestDescription`                                                             | Inspectable request shape from `toRequest()`.                                 |
| `NgQlCachePolicy`                                                                    | `'no-store' \| 'cache-first' \| 'network-first' \| 'stale-while-revalidate'`. |
| `QueryOperator`, `QueryValue`, `NgQlQueryState`                                      | Query builder primitives.                                                     |

### `NgQlQueryBuilder<TModel, TId>`

`where`, `orWhere`, `whereIn`, `whereNotIn`, `whereNull`, `whereNotNull`, `whereBetween`, `when`, `select`, `with`, `withQuery`, `append`, `orderBy`, `latest`, `oldest`, `limit`, `offset`, `page`, `perPage`, `setHeaders`, `setOptions` — all immutable chain methods.

`where`/`orWhere` also accept an object of equality conditions instead of `(field, value)`:

```ts
// Both entries are AND-ed together:
this.posts.query().where({ title: 'Hello', status: 'published' });

// orWhere() ORs the whole group against what came before it. Consecutive
// where() calls AND within a group; orWhere() starts a new group — i.e.
// where(a).where(b).orWhere(c).where(d)  =>  (a AND b) OR (c AND d):
this.posts.query().where('status', 'published').where('featured', true).orWhere('role', 'admin');
```

The default serializer nests every group under `filter[or][<groupIndex>]` as soon as any `orWhere` appears in the chain (see the wire-format table above); with no `orWhere` at all, output is unchanged from a single flat `filter[...]` group.

`get`, `first`, `paginate`, `find` — Observable execution. `getSignal`, `firstSignal`, `paginateSignal` — Signal execution. `toUrl`, `toQueryParams`, `toRequest` — inspection, no request performed.

### `NgQlResource<TModel, TId>`

`query`, `all`/`allSignal`, `find`/`findSignal`, `first`/`firstSignal`, `create`, `update`, `patch`, `destroy`, `getId`.

`getId(model)` reads the identifier off a model instance, honoring a custom `primaryKey` from `NgQlResourceConfig` (defaults to `'id'`) — useful when a backend doesn't call its identifier field `id`:

```ts
class WidgetResource extends NgQlResource<Widget> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'widgets', primaryKey: 'uuid' });
  }
}

this.widgets.getId(widget); // reads widget.uuid
```

#### `@NgQlEndpoint` — per-method URL/method/id-placement overrides

By default `update`/`patch` send `PUT`/`PATCH /posts/:id` and `create` sends `POST /posts`. Some backends don't follow that: they want a custom path, a different HTTP method, or the id in the request body instead of the URL (e.g. `POST /posts` with `{ id, ...payload }`). Override just the method(s) that differ by declaring an `override` that delegates to `super` and decorating it with `@NgQlEndpoint`:

```ts
import { NgQlEndpoint, NgQlResource } from 'ng-ql';

class PostResource extends NgQlResource<Post> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'posts' });
  }

  // Custom URL template — ':id' is replaced with the id argument:
  @NgQlEndpoint({ url: 'posts/:id/save' })
  override update(id: number, payload: Partial<Post>) {
    return super.update(id, payload);
  }

  // id in the body instead of the URL: POST /posts with { id, ...payload }:
  @NgQlEndpoint({ method: 'POST', idIn: 'body' })
  override patch(id: number, payload: Partial<Post>) {
    return super.patch(id, payload);
  }
}
```

`NgQlEndpointOptions`:

| Option   | Type                                                         | Default                                          |
| -------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `url`    | `string \| ((endpoint, id?) => string)`                       | `${endpoint}/:id` (or `endpoint` when `idIn: 'body'`) |
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'`             | the method's usual default (`PUT` for `update`, etc.) |
| `idIn`   | `'url' \| 'body'`                                             | `'url'`                                            |

`idIn: 'body'` merges the id into the payload under this resource's `primaryKey` (default `'id'`), unless the payload already has that key. Undecorated methods (`create`, `destroy`, or any method you don't override) keep their default URL/method/id behavior untouched.
