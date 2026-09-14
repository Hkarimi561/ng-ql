import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { generatePosts, generateProducts, generateUsers } from './mock-data';
import { runMockQuery } from './query-engine';
import { MockApiService } from '../services/mock-api.service';

type Row = Record<string, unknown>;

const datasets: Record<string, Row[]> = {
  posts: generatePosts() as unknown as Row[],
  users: generateUsers() as unknown as Row[],
  products: generateProducts() as unknown as Row[],
};

let nextId = 100000;

function findEndpoint(url: string): { endpoint: string; id: string | null } | null {
  const match = /\/api\/(posts|users|products)(?:\/([^/?]+))?\/?$/.exec(url);
  if (!match) return null;
  return { endpoint: match[1], id: match[2] ?? null };
}

/**
 * A functional `HttpInterceptorFn` that serves the showcase's Posts/Users/
 * Products resources entirely from in-memory mock data, so the app runs with
 * no external backend. Understands the default query-serializer's filter,
 * sort, include, field-selection, and pagination conventions, and supports
 * configurable latency/error simulation via {@link MockApiService}.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const target = findEndpoint(req.url);
  if (!target) return next(req);

  const mock = inject(MockApiService);
  const dataset = datasets[target.endpoint];
  const latency = mock.delay();

  const respond = (): Observable<HttpEvent<unknown>> => {
    if (mock.shouldFail()) {
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Internal Server Error',
            url: req.url,
            error: { message: 'Simulated failure (mock API error rate).' },
          }),
      );
    }

    if (req.method === 'GET' && target.id) {
      const item = dataset.find((row) => String(row['id']) === target.id);
      if (!item) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              statusText: 'Not Found',
              url: req.url,
              error: { message: 'Not found' },
            }),
        );
      }
      return of(new HttpResponse({ status: 200, body: { data: item } }));
    }

    if (req.method === 'GET') {
      const result = runMockQuery(dataset, req.params);
      return of(
        new HttpResponse({
          status: 200,
          body: {
            data: result.data,
            meta: {
              current_page: result.currentPage,
              per_page: result.perPage,
              total: result.total,
              last_page: result.lastPage,
            },
            links: {
              first: buildPageUrl(req.url, 1),
              last: buildPageUrl(req.url, result.lastPage),
              prev: result.currentPage > 1 ? buildPageUrl(req.url, result.currentPage - 1) : null,
              next:
                result.currentPage < result.lastPage
                  ? buildPageUrl(req.url, result.currentPage + 1)
                  : null,
            },
          },
        }),
      );
    }

    if (req.method === 'POST') {
      const created = { id: nextId++, ...(req.body as Row) };
      dataset.unshift(created);
      return of(new HttpResponse({ status: 201, body: { data: created } }));
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const index = dataset.findIndex((row) => String(row['id']) === target.id);
      if (index === -1) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              statusText: 'Not Found',
              url: req.url,
              error: { message: 'Not found' },
            }),
        );
      }
      dataset[index] = { ...dataset[index], ...(req.body as Row) };
      return of(new HttpResponse({ status: 200, body: { data: dataset[index] } }));
    }

    if (req.method === 'DELETE') {
      const index = dataset.findIndex((row) => String(row['id']) === target.id);
      if (index !== -1) dataset.splice(index, 1);
      return of(new HttpResponse({ status: 204, body: null }));
    }

    return throwError(
      () => new HttpErrorResponse({ status: 405, statusText: 'Method Not Allowed', url: req.url }),
    );
  };

  return latency > 0 ? respond().pipe(delay(latency)) : respond();
};

function buildPageUrl(url: string, page: number): string {
  const [base] = url.split('?');
  return `${base}?page[number]=${page}`;
}
