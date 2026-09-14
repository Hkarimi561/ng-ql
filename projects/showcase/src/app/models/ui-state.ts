import type { QueryOperator } from 'ng-ql';

export interface UiWhereClause {
  readonly id: number;
  field: string;
  operator: QueryOperator;
  value: string;
}

export const OPERATORS: readonly QueryOperator[] = [
  '=',
  '!=',
  '<>',
  '>',
  '>=',
  '<',
  '<=',
  'like',
  'not like',
];
