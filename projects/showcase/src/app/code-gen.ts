import type { NgQlCachePolicy } from 'ng-ql';
import type { ResourceKind } from './models/domain';
import type { UiWhereClause } from './models/ui-state';

export interface CodeGenInput {
  readonly resourceKind: ResourceKind;
  readonly wheres: readonly UiWhereClause[];
  readonly includes: readonly string[];
  readonly selectedFields: readonly string[];
  readonly sortField: string;
  readonly sortDir: 'asc' | 'desc';
  readonly page: number;
  readonly perPage: number;
  readonly cachePolicy: NgQlCachePolicy;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

function literalValue(raw: string): string {
  if (raw === '') return "''";
  if (raw === 'true' || raw === 'false') return raw;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== '') return raw;
  return quote(raw);
}

/** Renders the current showcase state as the equivalent ng-ql TypeScript call chain. */
export function generateCode(input: CodeGenInput): string {
  const propertyName = input.resourceKind;
  const lines: string[] = [`this.${propertyName}`, '  .query()'];

  for (const where of input.wheres) {
    if (!where.field) continue;
    if (where.operator === '=') {
      lines.push(`  .where(${quote(where.field)}, ${literalValue(where.value)})`);
    } else {
      lines.push(
        `  .where(${quote(where.field)}, ${quote(where.operator)}, ${literalValue(where.value)})`,
      );
    }
  }

  if (input.selectedFields.length > 0) {
    lines.push(`  .select([${input.selectedFields.map(quote).join(', ')}])`);
  }

  if (input.includes.length > 0) {
    lines.push(
      input.includes.length === 1
        ? `  .with(${quote(input.includes[0])})`
        : `  .with([${input.includes.map(quote).join(', ')}])`,
    );
  }

  if (input.sortField) {
    lines.push(`  .orderBy(${quote(input.sortField)}, ${quote(input.sortDir)})`);
  }

  lines.push(
    `  .paginateSignal(${input.page}, ${input.perPage}, { cache: ${quote(input.cachePolicy)} });`,
  );

  return lines.join('\n');
}

export type MutationAction = 'create' | 'update' | 'patch' | 'destroy';

export interface MutationCodeInput {
  readonly resourceKind: ResourceKind;
  readonly action: MutationAction;
  readonly id: string;
  /** Field name -> raw string value, as typed into the mutation form. Empty values are omitted. */
  readonly fields: Readonly<Record<string, string>>;
}

function payloadLiteral(fields: Readonly<Record<string, string>>): string {
  const entries = Object.entries(fields).filter(([, value]) => value !== '');
  if (entries.length === 0) return '{}';
  const body = entries.map(([key, value]) => `${key}: ${literalValue(value)}`).join(', ');
  return `{ ${body} }`;
}

/** Renders the current mutation-panel state as the equivalent ng-ql TypeScript call. */
export function generateMutationCode(input: MutationCodeInput): string {
  const propertyName = input.resourceKind;
  const id = input.id || '<id>';
  const payload = payloadLiteral(input.fields);

  switch (input.action) {
    case 'create':
      return `this.${propertyName}.create(${payload}).subscribe((created) => console.log(created));`;
    case 'update':
      return `this.${propertyName}.update(${id}, ${payload}).subscribe((updated) => console.log(updated));`;
    case 'patch':
      return `this.${propertyName}.patch(${id}, ${payload}).subscribe((patched) => console.log(patched));`;
    case 'destroy':
      return `this.${propertyName}.destroy(${id}).subscribe(() => console.log('deleted'));`;
  }
}
