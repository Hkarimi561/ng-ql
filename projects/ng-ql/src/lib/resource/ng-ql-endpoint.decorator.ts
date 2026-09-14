import type { NgQlHttpMethod } from '../models/query-types';

/** Per-method endpoint override accepted by {@link NgQlEndpoint}. */
export interface NgQlEndpointOptions {
  /**
   * URL template relative to the resource's `endpoint` (or absolute). `:id`
   * is replaced with the id argument, URI-encoded. Pass a function for full
   * control — it receives the raw `endpoint` and `id` and returns the
   * complete URL.
   *
   * Defaults to `${endpoint}/:id` when `idIn` is `'url'` (the default), or
   * to `endpoint` itself when `idIn` is `'body'`.
   */
  readonly url?: string | ((endpoint: string, id?: unknown) => string);

  /** Overrides the HTTP method used for the request. */
  readonly method?: NgQlHttpMethod;

  /**
   * Where the id belongs. `'url'` (default) appends it to the URL — as the
   * `:id` segment, or via `url`. `'body'` omits it from the URL instead and
   * merges it into the request body, for APIs that expect e.g.
   * `POST /posts` with `{ id, ...payload }` rather than `PUT /posts/123`.
   */
  readonly idIn?: 'url' | 'body';
}

const ENDPOINT_OPTIONS = Symbol('ngQlEndpointOptions');

type EndpointMap = Record<string, NgQlEndpointOptions>;

interface EndpointHost {
  [ENDPOINT_OPTIONS]?: EndpointMap;
}

/**
 * Method decorator overriding how a {@link NgQlResource} method resolves its
 * URL, HTTP method, and id placement. Apply it to an `override`d
 * `create`/`update`/`patch`/`destroy` (delegating to `super`) to customize
 * just that one resource:
 *
 * ```ts
 * class PostResource extends NgQlResource<Post> {
 *   constructor(client: NgQlClient) {
 *     super(client, { endpoint: 'posts' });
 *   }
 *
 *   // PUT /posts/:id (the default) — shown for a custom url template:
 *   @NgQlEndpoint({ url: '/posts/:id' })
 *   override update(id: number, payload: Partial<Post>) {
 *     return super.update(id, payload);
 *   }
 *
 *   // POST /posts with { id, ...payload } instead of PATCH /posts/:id:
 *   @NgQlEndpoint({ method: 'POST', idIn: 'body' })
 *   override patch(id: number, payload: Partial<Post>) {
 *     return super.patch(id, payload);
 *   }
 * }
 * ```
 */
export function NgQlEndpoint(options: NgQlEndpointOptions) {
  return function (target: object, propertyKey: string | symbol): void {
    const ctor = target.constructor as EndpointHost;
    const inherited = ctor[ENDPOINT_OPTIONS] ?? {};
    const own: EndpointMap = Object.prototype.hasOwnProperty.call(ctor, ENDPOINT_OPTIONS)
      ? inherited
      : { ...inherited };
    own[propertyKey as string] = options;
    Object.defineProperty(ctor, ENDPOINT_OPTIONS, {
      value: own,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  };
}

/** Reads the {@link NgQlEndpoint} options for `methodName` on `instance`'s class, if any. */
export function getEndpointOptions(
  instance: object,
  methodName: string,
): NgQlEndpointOptions | undefined {
  const ctor = instance.constructor as EndpointHost;
  return ctor[ENDPOINT_OPTIONS]?.[methodName];
}
