import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNgQl } from 'ng-ql';

import { routes } from './app.routes';
import { mockApiInterceptor } from './mock/mock-api.interceptor';
import { showcaseQuerySerializer } from './services/toggleable-query-serializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([mockApiInterceptor])),
    provideNgQl({
      baseUrl: '/api',
      defaultHeaders: { Accept: 'application/json' },
      defaultCachePolicy: 'no-store',
      defaultCacheTtl: 30_000,
      querySerializer: showcaseQuerySerializer,
    }),
  ],
};
