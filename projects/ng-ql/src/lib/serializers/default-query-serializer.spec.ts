import { describe, expect, it } from 'vitest';
import type { NgQlQueryState } from '../models/query-types';
import { DefaultNgQlQuerySerializer } from './default-query-serializer';

const EMPTY: NgQlQueryState = { wheres: [], selects: [], includes: [], sorts: [], extraParams: [] };

describe('DefaultNgQlQuerySerializer', () => {
  const serializer = new DefaultNgQlQuerySerializer();

  it('serializes an equality where clause without an operator suffix', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'basic', field: 'status', operator: '=', value: 'published' }],
    });
    expect(params.toString()).toBe('filter[status]=published');
    expect(params.get('filter[status]')).toBe('published');
  });

  it('serializes an explicit comparison operator', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'basic', field: 'price', operator: '>=', value: 100 }],
    });
    expect(params.get('filter[price][gte]')).toBe('100');
  });

  it('preserves false and 0 (does not drop falsy values)', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [
        { kind: 'basic', field: 'active', operator: '=', value: false },
        { kind: 'basic', field: 'count', operator: '=', value: 0 },
      ],
    });
    expect(params.get('filter[active]')).toBe('false');
    expect(params.get('filter[count]')).toBe('0');
  });

  it('serializes whereIn as repeated bracketed params, preserving every value', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'in', field: 'categoryId', values: [1, 2, 3], negate: false }],
    });
    expect(params.getAll('filter[categoryId][]')).toEqual(['1', '2', '3']);
  });

  it('serializes whereNotIn distinctly from whereIn', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'in', field: 'categoryId', values: [1, 2], negate: true }],
    });
    expect(params.getAll('filter[categoryId][not_in][]')).toEqual(['1', '2']);
    expect(params.getAll('filter[categoryId][]') ?? []).toEqual([]);
  });

  it('serializes whereNull as an explicit "null" literal', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'null', field: 'deletedAt', negate: false }],
    });
    expect(params.get('filter[deletedAt]')).toBe('null');
  });

  it('serializes whereNotNull distinctly from whereNull', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'null', field: 'deletedAt', negate: true }],
    });
    expect(params.get('filter[deletedAt][ne]')).toBe('null');
  });

  it('serializes whereBetween as a comma-joined range', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'between', field: 'price', range: [10, 20] }],
    });
    expect(params.get('filter[price][between]')).toBe('10,20');
  });

  it('serializes select as a comma-joined fields param', () => {
    const params = serializer.serialize({ ...EMPTY, selects: ['id', 'title'] });
    expect(params.get('fields')).toBe('id,title');
  });

  it('serializes with() as a comma-joined include param', () => {
    const params = serializer.serialize({ ...EMPTY, includes: ['author', 'comments'] });
    expect(params.get('include')).toBe('author,comments');
  });

  it('serializes descending orderBy with a leading dash', () => {
    const params = serializer.serialize({
      ...EMPTY,
      sorts: [{ field: 'createdAt', direction: 'desc' }],
    });
    expect(params.get('sort')).toBe('-createdAt');
  });

  it('serializes ascending orderBy without a dash', () => {
    const params = serializer.serialize({ ...EMPTY, sorts: [{ field: 'name', direction: 'asc' }] });
    expect(params.get('sort')).toBe('name');
  });

  it('serializes multiple sorts as a comma-joined list', () => {
    const params = serializer.serialize({
      ...EMPTY,
      sorts: [
        { field: 'name', direction: 'asc' },
        { field: 'createdAt', direction: 'desc' },
      ],
    });
    expect(params.get('sort')).toBe('name,-createdAt');
  });

  it('serializes limit as page[size]', () => {
    const params = serializer.serialize({ ...EMPTY, limitValue: 10 });
    expect(params.get('page[size]')).toBe('10');
  });

  it('serializes page(2, 20) as page[number] and page[size]', () => {
    const params = serializer.serialize({ ...EMPTY, pageValue: 2, perPageValue: 20 });
    expect(params.get('page[number]')).toBe('2');
    expect(params.get('page[size]')).toBe('20');
  });

  it('prefers perPageValue over limitValue for page[size] when both are set', () => {
    const params = serializer.serialize({ ...EMPTY, limitValue: 10, perPageValue: 25 });
    expect(params.get('page[size]')).toBe('25');
  });

  it('ignores undefined extra params but keeps explicit null as the literal "null"', () => {
    const params = serializer.serialize({
      ...EMPTY,
      extraParams: [
        { key: 'ignored', value: undefined },
        { key: 'explicit', value: null },
      ],
    });
    expect(params.has('ignored')).toBe(false);
    expect(params.get('explicit')).toBe('null');
  });

  it('serializes array-valued extra params as repeated bracketed keys', () => {
    const params = serializer.serialize({
      ...EMPTY,
      extraParams: [{ key: 'tags', value: ['a', 'b'] }],
    });
    expect(params.getAll('tags[]')).toEqual(['a', 'b']);
  });

  it('never produces "[object Object]" for any supported value shape', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [{ kind: 'basic', field: 'status', operator: '=', value: 'published' }],
      extraParams: [{ key: 'tags', value: ['a', 'b'] }],
    });
    expect(params.toString()).not.toContain('object');
  });

  it('produces an identical serialization regardless of clause insertion order', () => {
    const a = serializer.serialize({
      ...EMPTY,
      wheres: [
        { kind: 'basic', field: 'status', operator: '=', value: 'published' },
        { kind: 'basic', field: 'price', operator: '>=', value: 100 },
      ],
    });
    const b = serializer.serialize({
      ...EMPTY,
      wheres: [
        { kind: 'basic', field: 'price', operator: '>=', value: 100 },
        { kind: 'basic', field: 'status', operator: '=', value: 'published' },
      ],
    });
    expect(a.toString()).toBe(b.toString());
  });
});
