import { Injectable } from '@angular/core';
import { NgQlClient, NgQlResource } from 'ng-ql';
import type { User } from '../models/user.model';

/**
 * Typed ng-ql resource for the `/users` endpoint.
 *
 * ```ts
 * private readonly users = inject(UserResource);
 *
 * // Observable: filter, sort, paginate
 * this.users
 *   .query()
 *   .where('role', 'admin')
 *   .whereNotNull('email')
 *   .orderBy('name')
 *   .get()
 *   .subscribe((admins) => console.log(admins));
 *
 * // Signal: cache-first reads with manual refresh/invalidate
 * protected readonly activeUsers = this.users
 *   .query()
 *   .where('active', true)
 *   .getSignal({ cache: 'cache-first', cacheTtl: 60_000 });
 *
 * // CRUD
 * this.users.create({ name: 'Ada Lovelace', email: 'ada@example.com', role: 'editor', active: true });
 * this.users.patch(7, { active: false }).subscribe();
 * this.users.destroy(7).subscribe();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UserResource extends NgQlResource<User, number> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'users', cacheTags: ['users'] });
  }
}
