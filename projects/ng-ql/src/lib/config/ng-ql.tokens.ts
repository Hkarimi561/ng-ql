import { InjectionToken } from '@angular/core';
import type { NgQlResolvedConfig } from './ng-ql-config';

/** Injection token holding the resolved {@link NgQlConfig}. Internal — not part of the public API. */
export const NGQL_CONFIG = new InjectionToken<NgQlResolvedConfig>('NGQL_CONFIG');
