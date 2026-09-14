import { NgQlValidationError } from '../errors/ng-ql-validation-error';

export function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || Number.isNaN(value) || !Number.isInteger(value) || value < 1) {
    throw new NgQlValidationError(`ng-ql: ${label} must be a positive integer, received ${value}.`);
  }
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || Number.isNaN(value) || !Number.isInteger(value) || value < 0) {
    throw new NgQlValidationError(
      `ng-ql: ${label} must be a non-negative integer, received ${value}.`,
    );
  }
}
