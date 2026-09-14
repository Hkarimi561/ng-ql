/*
 * Public API surface of ng-ql.
 */

// Configuration
export { provideNgQl } from './lib/config/provide-ng-ql';
export type { NgQlConfig } from './lib/config/ng-ql-config';

// Client
export { NgQlClient } from './lib/client/ng-ql-client';

// Resource
export { NgQlResource } from './lib/resource/ng-ql-resource';
export type { NgQlResourceConfig } from './lib/resource/resource-config';

// Query builder
export { NgQlQueryBuilder } from './lib/query/ng-ql-query-builder';
export type {
  QueryOperator,
  QueryValue,
  NgQlQueryState,
  NgQlWhereConnector,
} from './lib/models/query-types';
export type { NgQlRequestDescription } from './lib/models/request-description';

// Cache
export { NgQlCacheService } from './lib/cache/ng-ql-cache.service';
export type { NgQlCachePolicy } from './lib/models/cache-policy';

// Request options & state
export type { NgQlRequestOptions, NgQlSignalRequestOptions } from './lib/models/request-options';
export type {
  NgQlRequestState,
  NgQlPaginatedRequestState,
  NgQlRequestStatus,
} from './lib/models/state';

// Pagination
export type {
  NgQlPaginationMeta,
  NgQlPaginationLinks,
  NgQlPaginatedResponse,
} from './lib/models/pagination';

// Serializers & adapters
export type { NgQlQuerySerializer } from './lib/serializers/query-serializer';
export { DefaultNgQlQuerySerializer } from './lib/serializers/default-query-serializer';
export type { DefaultNgQlQuerySerializerOptions } from './lib/serializers/default-query-serializer';
export type { NgQlResponseAdapter } from './lib/adapters/response-adapter';
export { DefaultNgQlResponseAdapter } from './lib/adapters/default-response-adapter';

// Errors
export { NgQlValidationError } from './lib/errors/ng-ql-validation-error';
