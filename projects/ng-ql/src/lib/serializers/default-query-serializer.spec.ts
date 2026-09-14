import { describe, expect, it } from 'vitest';
import type { NgQlQueryState, NgQlWhereCondition } from '../models/query-types';
import { DefaultNgQlQuerySerializer } from './default-query-serializer';

const EMPTY: NgQlQueryState = { wheres: [], selects: [], includes: [], sorts: [], extraParams: [] };

/** Shorthand for building an AND-connected where condition in test fixtures. */
function and<T extends Omit<NgQlWhereCondition, 'connector'>>(
  condition: T,
): T & { connector: 'and' } {
  return { ...condition, connector: 'and' };
}

/** Shorthand for building an OR-connected where condition in test fixtures. */
function or<T extends Omit<NgQlWhereCondition, 'connector'>>(
  condition: T,
): T & { connector: 'or' } {
  return { ...condition, connector: 'or' };
}

describe('DefaultNgQlQuerySerializer', () => {
  const serializer = new DefaultNgQlQuerySerializer();

  it('serializes an equality where clause without an operator suffix', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'basic', field: 'status', operator: '=', value: 'published' })],
    });
    expect(params.toString()).toBe('filter[status]=published');
    expect(params.get('filter[status]')).toBe('published');
  });

  it('serializes an explicit comparison operator', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'basic', field: 'price', operator: '>=', value: 100 })],
    });
    expect(params.get('filter[price][gte]')).toBe('100');
  });

  it('preserves false and 0 (does not drop falsy values)', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'basic', field: 'active', operator: '=', value: false }),
        and({ kind: 'basic', field: 'count', operator: '=', value: 0 }),
      ],
    });
    expect(params.get('filter[active]')).toBe('false');
    expect(params.get('filter[count]')).toBe('0');
  });

  it('serializes whereIn as repeated bracketed params, preserving every value', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'in', field: 'categoryId', values: [1, 2, 3], negate: false })],
    });
    expect(params.getAll('filter[categoryId][]')).toEqual(['1', '2', '3']);
  });

  it('serializes whereNotIn distinctly from whereIn', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'in', field: 'categoryId', values: [1, 2], negate: true })],
    });
    expect(params.getAll('filter[categoryId][not_in][]')).toEqual(['1', '2']);
    expect(params.getAll('filter[categoryId][]') ?? []).toEqual([]);
  });

  it('serializes whereNull as an explicit "null" literal', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'null', field: 'deletedAt', negate: false })],
    });
    expect(params.get('filter[deletedAt]')).toBe('null');
  });

  it('serializes whereNotNull distinctly from whereNull', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'null', field: 'deletedAt', negate: true })],
    });
    expect(params.get('filter[deletedAt][ne]')).toBe('null');
  });

  it('serializes whereBetween as a comma-joined range', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [and({ kind: 'between', field: 'price', range: [10, 20] })],
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
      wheres: [and({ kind: 'basic', field: 'status', operator: '=', value: 'published' })],
      extraParams: [{ key: 'tags', value: ['a', 'b'] }],
    });
    expect(params.toString()).not.toContain('object');
  });

  it('produces an identical serialization regardless of clause insertion order (single AND group)', () => {
    const a = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'basic', field: 'status', operator: '=', value: 'published' }),
        and({ kind: 'basic', field: 'price', operator: '>=', value: 100 }),
      ],
    });
    const b = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'basic', field: 'price', operator: '>=', value: 100 }),
        and({ kind: 'basic', field: 'status', operator: '=', value: 'published' }),
      ],
    });
    expect(a.toString()).toBe(b.toString());
  });

  // -----------------------------------------------------------------------
  // orWhere grouping
  // -----------------------------------------------------------------------

  it('keeps a single flat "filter[...]" shape when no orWhere is used', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'basic', field: 'status', operator: '=', value: 'published' }),
        and({ kind: 'basic', field: 'featured', operator: '=', value: true }),
      ],
    });
    expect(params.get('filter[status]')).toBe('published');
    expect(params.get('filter[featured]')).toBe('true');
    expect(params.has('filter[or][0][status]')).toBe(false);
  });

  it('nests every group under filter[or][<index>] once an orWhere is present', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'basic', field: 'status', operator: '=', value: 'published' }),
        or({ kind: 'basic', field: 'featured', operator: '=', value: true }),
      ],
    });
    expect(params.get('filter[or][0][status]')).toBe('published');
    expect(params.get('filter[or][1][featured]')).toBe('true');
    expect(params.has('filter[status]')).toBe(false);
  });

  it('groups consecutive AND conditions together within the same OR group', () => {
    // where(a).where(b).orWhere(c).where(d)  =>  (a AND b) OR (c AND d)
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'basic', field: 'a', operator: '=', value: 1 }),
        and({ kind: 'basic', field: 'b', operator: '=', value: 2 }),
        or({ kind: 'basic', field: 'c', operator: '=', value: 3 }),
        and({ kind: 'basic', field: 'd', operator: '=', value: 4 }),
      ],
    });
    expect(params.get('filter[or][0][a]')).toBe('1');
    expect(params.get('filter[or][0][b]')).toBe('2');
    expect(params.get('filter[or][1][c]')).toBe('3');
    expect(params.get('filter[or][1][d]')).toBe('4');
  });

  it('supports whereIn/whereNull/whereBetween inside an OR group', () => {
    const params = serializer.serialize({
      ...EMPTY,
      wheres: [
        and({ kind: 'in', field: 'categoryId', values: [1, 2], negate: false }),
        or({ kind: 'between', field: 'price', range: [10, 20] }),
      ],
    });
    expect(params.getAll('filter[or][0][categoryId][]')).toEqual(['1', '2']);
    expect(params.get('filter[or][1][price][between]')).toBe('10,20');
  });
});
