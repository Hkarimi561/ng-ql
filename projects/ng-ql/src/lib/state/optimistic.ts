import type { DestroyRef, WritableSignal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { NgQlRequestStatus } from '../models/state';

export interface OptimisticContext<T> {
  readonly dataSignal: WritableSignal<T | null>;
  readonly statusSignal: WritableSignal<NgQlRequestStatus>;
  readonly errorSignal: WritableSignal<unknown | null>;
  readonly destroyRef: DestroyRef;
}

/**
 * Shared implementation of `NgQlRequestState#mutateOptimistically`: applies
 * `updater` synchronously, subscribes to `commit()`, and rolls the signals
 * back to their pre-mutation values if it errors. Deliberately does not
 * touch the cache — a mutation's own cache invalidation already governs
 * what a later `refresh()`/`cache-first` read sees.
 */
export function runOptimisticMutation<T, R>(
  ctx: OptimisticContext<T>,
  updater: (current: T | null) => T,
  commit: () => Observable<R>,
): void {
  const previousValue = ctx.dataSignal();
  const previousStatus = ctx.statusSignal();

  ctx.dataSignal.set(updater(previousValue));
  ctx.statusSignal.set('success');
  ctx.errorSignal.set(null);

  const subscription = commit().subscribe({
    error: (error: unknown) => {
      ctx.dataSignal.set(previousValue);
      ctx.statusSignal.set(previousStatus);
      ctx.errorSignal.set(error);
    },
  });

  ctx.destroyRef.onDestroy(() => subscription.unsubscribe());
}
