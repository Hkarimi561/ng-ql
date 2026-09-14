import { computed, signal } from '@angular/core';
import type { NgQlQuerySerializer, NgQlQueryState } from 'ng-ql';
import { DefaultNgQlQuerySerializer } from 'ng-ql';
import type { HttpParams } from '@angular/common/http';

/**
 * Wraps {@link DefaultNgQlQuerySerializer} with a runtime-toggleable
 * `filterPrefix`, so the Interactive Console can demonstrate both the
 * default `filter[field]=value` envelope and the bare `field=value` form
 * from a single checkbox, without re-bootstrapping the app.
 */
export class ToggleableQuerySerializer implements NgQlQuerySerializer {
  readonly useFilterPrefix = signal(true);

  private readonly delegate = computed(() =>
    this.useFilterPrefix()
      ? new DefaultNgQlQuerySerializer()
      : new DefaultNgQlQuerySerializer({ filterPrefix: null }),
  );

  serialize(state: NgQlQueryState): HttpParams {
    return this.delegate().serialize(state);
  }
}

/** Singleton instance shared between `provideNgQl` (bootstrap) and the console UI. */
export const showcaseQuerySerializer = new ToggleableQuerySerializer();
