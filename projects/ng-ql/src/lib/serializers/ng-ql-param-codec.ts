import type { HttpParameterCodec } from '@angular/common/http';

/**
 * An `HttpParameterCodec` that keeps `[` and `]` readable in the resulting URL
 * (e.g. `filter[status]=published`) while still percent-encoding everything
 * else correctly, including the value portion.
 */
export class NgQlParamCodec implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key).replace(/%5B/g, '[').replace(/%5D/g, ']');
  }

  encodeValue(value: string): string {
    return encodeURIComponent(value);
  }

  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }

  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}
