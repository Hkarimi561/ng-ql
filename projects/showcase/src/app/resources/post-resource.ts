import { Injectable } from '@angular/core';
import { NgQlClient, NgQlResource } from 'ng-ql';
import type { Post } from '../models/post.model';

/**
 * Typed ng-ql resource for the `/posts` endpoint.
 *
 * This is the entire integration: extend {@link NgQlResource}, pass it the
 * `NgQlClient` (injected like any other service) and an endpoint. Everything
 * else — building requests, caching, CRUD — comes from the base class.
 *
 * ### Observable API
 * ```ts
 * private readonly posts = inject(PostResource);
 *
 * this.posts
 *   .query()
 *   .where('status', 'published')
 *   .whereIn('categoryId', [1, 2])
 *   .with('author')
 *   .orderBy('createdAt', 'desc')
 *   .limit(10)
 *   .get()
 *   .subscribe((posts) => console.log(posts));
 *
 * this.posts.first().subscribe((post) => console.log(post)); // null if none
 * this.posts.find(42).subscribe((post) => console.log(post));
 * this.posts.query().paginate(1, 20).subscribe((page) => console.log(page.data, page.meta));
 * ```
 *
 * ### Signal API
 * ```ts
 * // Call from a field initializer, constructor, or runInInjectionContext(...).
 * protected readonly publishedPosts = this.posts
 *   .query()
 *   .where('status', 'published')
 *   .orderBy('createdAt', 'desc')
 *   .getSignal({ cache: 'stale-while-revalidate', cacheTtl: 30_000 });
 *
 * // In the template: publishedPosts.data() / .loading() / .error() / .status()
 * // publishedPosts.refresh() / publishedPosts.invalidate()
 *
 * protected readonly postsPage = this.posts.query().paginateSignal(1, 10);
 * // postsPage.data() / .meta() / .links() / .setPage(2) / .setPerPage(25)
 * ```
 *
 * ### CRUD (POST / PUT / PATCH / DELETE)
 * ```ts
 * this.posts.create({ title: 'New post', status: 'draft' }).subscribe();
 * this.posts.update(1, { title: 'Replaces the whole record' }).subscribe();
 * this.posts.patch(1, { status: 'published' }).subscribe();
 * this.posts.destroy(1).subscribe();
 * // Every one of these automatically invalidates cached `posts` reads.
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PostResource extends NgQlResource<Post, number> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'posts', cacheTags: ['posts'] });
  }
}
