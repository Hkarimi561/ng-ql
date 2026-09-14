import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { User } from '../models/user.model';
import { UserResource } from '../resources/user-resource';

/**
 * A real feature built on `UserResource` — a Signal-backed list plus a
 * create/edit form, and a one-click PATCH to toggle `active` without
 * opening the form at all.
 */
@Component({
  selector: 'app-user-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-manager.component.html',
  styleUrl: './user-manager.component.scss',
})
export class UserManagerComponent {
  private readonly users = inject(UserResource);

  protected readonly usersState = this.users.query().orderBy('name').paginateSignal(1, 5);

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected form: Partial<User> = this.emptyForm();

  private emptyForm(): Partial<User> {
    return { name: '', email: '', role: 'viewer', active: true };
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  startEdit(user: User): void {
    this.editingId.set(user.id);
    this.form = { name: user.name, email: user.email, role: user.role, active: user.active };
    this.formOpen.set(true);
  }

  cancel(): void {
    this.formOpen.set(false);
  }

  save(): void {
    const id = this.editingId();
    this.saving.set(true);
    const request = id === null ? this.users.create(this.form) : this.users.update(id, this.form);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.usersState.refresh();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(user: User): void {
    this.users.patch(user.id, { active: !user.active }).subscribe(() => this.usersState.refresh());
  }

  remove(id: number): void {
    this.users.destroy(id).subscribe(() => this.usersState.refresh());
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.usersState.setPage(page);
  }
}
