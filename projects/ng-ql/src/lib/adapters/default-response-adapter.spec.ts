import { describe, expect, it } from 'vitest';
import { DefaultNgQlResponseAdapter } from './default-response-adapter';

interface Post {
  id: number;
  title: string;
}

describe('DefaultNgQlResponseAdapter', () => {
  const adapter = new DefaultNgQlResponseAdapter();

  it('adapts a raw array collection', () => {
    const raw = [{ id: 1, title: 'First post' }];
    expect(adapter.adaptCollection<Post>(raw)).toEqual(raw);
  });

  it('adapts a data-wrapped collection', () => {
    const raw = { data: [{ id: 1, title: 'First post' }] };
    expect(adapter.adaptCollection<Post>(raw)).toEqual(raw.data);
  });

  it('adapts a data-wrapped item', () => {
    const raw = { data: { id: 1, title: 'First post' } };
    expect(adapter.adaptItem<Post>(raw)).toEqual(raw.data);
  });

  it('adapts a raw item object', () => {
    const raw = { id: 1, title: 'First post' };
    expect(adapter.adaptItem<Post>(raw)).toEqual(raw);
  });

  it('returns null for an empty item response', () => {
    expect(adapter.adaptItem<Post>(null)).toBeNull();
    expect(adapter.adaptItem<Post>({ data: null })).toBeNull();
  });

  it('adapts a paginated response with snake_case meta and links', () => {
    const raw = {
      data: [{ id: 1, title: 'First post' }],
      meta: { current_page: 1, last_page: 4, per_page: 10, total: 40 },
      links: { first: 'a', last: 'b', prev: null, next: 'c' },
    };
    const result = adapter.adaptPaginated<Post>(raw);
    expect(result.data).toEqual(raw.data);
    expect(result.meta).toEqual({ currentPage: 1, lastPage: 4, perPage: 10, total: 40 });
    expect(result.links).toEqual({ first: 'a', last: 'b', prev: null, next: 'c' });
    expect(result.raw).toBe(raw);
  });

  it('adapts a paginated response with camelCase meta', () => {
    const raw = {
      data: [{ id: 1, title: 'First post' }],
      meta: { currentPage: 2, lastPage: 5, perPage: 10, total: 41 },
    };
    const result = adapter.adaptPaginated<Post>(raw);
    expect(result.meta).toEqual({ currentPage: 2, lastPage: 5, perPage: 10, total: 41 });
  });
});
