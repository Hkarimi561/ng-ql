/**
 * Thrown synchronously by the query builder when an invalid value is supplied
 * (e.g. a negative `limit`, a `page` below `1`, or `NaN`). Always thrown
 * before any HTTP request is made.
 */
export class NgQlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NgQlValidationError';
    Object.setPrototypeOf(this, NgQlValidationError.prototype);
  }
}
