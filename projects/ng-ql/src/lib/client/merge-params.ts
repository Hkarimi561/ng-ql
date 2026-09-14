import { HttpParams } from '@angular/common/http';
import type { QueryValue } from '../models/query-types';
import { NgQlParamCodec } from '../serializers/ng-ql-param-codec';

export type ParamsInput =
  HttpParams | Record<string, QueryValue | readonly QueryValue[] | null | undefined> | undefined;

function toHttpParams(input: ParamsInput): HttpParams {
  if (input instanceof HttpParams) return input;
  let params = new HttpParams({ encoder: new NgQlParamCodec() });
  if (!input) return params;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value === null) {
      params = params.append(key, 'null');
    } else if (Array.isArray(value)) {
      for (const v of value) {
        params = params.append(`${key}[]`, v === null ? 'null' : String(v));
      }
    } else {
      params = params.append(key, String(value));
    }
  }
  return params;
}

/** Appends every key/value pair from `extra` onto `base`, preserving repeated keys. */
export function mergeParams(base: HttpParams, extra: ParamsInput): HttpParams {
  const extraParams = toHttpParams(extra);
  let result = base;
  for (const key of extraParams.keys()) {
    for (const value of extraParams.getAll(key) ?? []) {
      result = result.append(key, value);
    }
  }
  return result;
}
