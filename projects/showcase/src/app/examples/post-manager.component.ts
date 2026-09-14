import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Post } from '../models/post.model';
import { PostResource } from '../resources/post-resource';

/**
 * A complete, real feature component built directly on ng-ql — not a
 * generic/dynamic viewer. This is what consuming `PostResource` in an
 * actual application looks like: a paginated Signal-backed list, a
 * create/edit form, and one-click PATCH/DELETE actions, all typed against
 * the plain {@link Post} model.
 */
@Component({
  selector: 'app-post-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-manager.component.html',
  styleUrl: './post-manager.component.scss',
})
export class PostManagerComponent {
  private readonly posts = inject(PostResource);

  /** A live, cached, paginated Signal read — created once, right here. */
  protected readonly postsState = this.posts
    .query()
    .orderBy('createdAt', 'desc')
    .paginateSignal(1, 5);

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected form: Partial<Post> = this.emptyForm();

  private emptyForm(): Partial<Post> {
    return { title: '', status: 'draft', categoryId: 1, authorId: 1 };
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  startEdit(post: Post): void {
    this.editingId.set(post.id);
    this.form = {
      title: post.title,
      status: post.status,
      categoryId: post.categoryId,
      authorId: post.authorId,
    };
    this.formOpen.set(true);
  }

  cancel(): void {
    this.formOpen.set(false);
  }

  save(): void {
    const id = this.editingId();
    this.saving.set(true);
    const request = id === null ? this.posts.create(this.form) : this.posts.update(id, this.form);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.postsState.refresh();
      },
      error: () => this.saving.set(false),
    });
  }

  /** A one-click PATCH — a real partial update, not the full form. */
  publish(post: Post): void {
    this.posts.patch(post.id, { status: 'published' }).subscribe(() => this.postsState.refresh());
  }

  remove(id: number): void {
    this.posts.destroy(id).subscribe(() => this.postsState.refresh());
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.postsState.setPage(page);
  }
}
