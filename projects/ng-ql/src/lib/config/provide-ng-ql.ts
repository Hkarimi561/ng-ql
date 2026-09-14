import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { DefaultNgQlQuerySerializer } from '../serializers/default-query-serializer';
import { DefaultNgQlResponseAdapter } from '../adapters/default-response-adapter';
import type { NgQlConfig, NgQlResolvedConfig } from './ng-ql-config';
import { NGQL_CONFIG } from './ng-ql.tokens';

const DEFAULT_CACHE_TTL_MS = 60_000;

/**
 * Registers ng-ql's global configuration, ready to inject `NgQlClient` and
 * any `NgQlResource` subclasses.
 *
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideHttpClient(),
 *     provideNgQl({ baseUrl: 'https://api.example.com/v1' }),
 *   ],
 * });
 * ```
 */
export function provideNgQl(config: NgQlConfig): EnvironmentProviders {
  const resolved: NgQlResolvedConfig = {
    ...config,
    defaultCachePolicy: config.defaultCachePolicy ?? 'no-store',
    defaultCacheTtl: config.defaultCacheTtl ?? DEFAULT_CACHE_TTL_MS,
    querySerializer: config.querySerializer ?? new DefaultNgQlQuerySerializer(),
    responseAdapter: config.responseAdapter ?? new DefaultNgQlResponseAdapter(),
  };

  return makeEnvironmentProviders([{ provide: NGQL_CONFIG, useValue: resolved }]);
}
