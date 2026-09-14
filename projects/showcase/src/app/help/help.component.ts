import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CodeBlockComponent } from '../components/code-preview/code-block';

const INSTALL = `npm install ng-ql`;

const PROVIDER_SETUP = `import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideNgQl } from 'ng-ql';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideNgQl({
      baseUrl: 'https://api.example.com/v1',
      defaultHeaders: { Accept: 'application/json' },
      defaultCachePolicy: 'no-store',
      defaultCacheTtl: 60_000,
    }),
  ],
});`;

const MODEL = `// posts/post.model.ts
export interface Post {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  categoryId: number;
  authorId: number;
  createdAt: string;
}`;

const RESOURCE = `// posts/post-resource.ts
import { Injectable } from '@angular/core';
import { NgQlClient, NgQlResource } from 'ng-ql';
import type { Post } from './post.model';

@Injectable({ providedIn: 'root' })
export class PostResource extends NgQlResource<Post, number> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'posts', cacheTags: ['posts'] });
  }
}`;

const OBSERVABLE_USAGE = `private readonly posts = inject(PostResource);

this.posts
  .query()
  .where('status', 'published')
  .whereIn('categoryId', [1, 2])
  .with('author')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get()
  .subscribe((posts) => console.log(posts));

this.posts.first().subscribe((post) => console.log(post)); // null if none
this.posts.find(42).subscribe((post) => console.log(post));
this.posts.query().paginate(1, 20).subscribe((page) => {
  console.log(page.data, page.meta, page.links);
});`;

const SIGNAL_USAGE = `// Call from a field initializer, a constructor, or runInInjectionContext(...)
protected readonly publishedPosts = this.posts
  .query()
  .where('status', 'published')
  .orderBy('createdAt', 'desc')
  .getSignal({ cache: 'stale-while-revalidate', cacheTtl: 30_000 });

// In the template:
// publishedPosts.data() / .loading() / .error() / .status() / .hasData()
// publishedPosts.refresh() / publishedPosts.invalidate()

protected readonly postsPage = this.posts.query().paginateSignal(1, 10);
// postsPage.data() / .meta() / .links()
// postsPage.setPage(2) / postsPage.setPerPage(25)`;

const CRUD_USAGE = `this.posts.create({ title: 'New post', status: 'draft' }).subscribe();
this.posts.update(1, { title: 'Replaces the whole record' }).subscribe();
this.posts.patch(1, { status: 'published' }).subscribe();
this.posts.destroy(1).subscribe();
// Every one of these automatically invalidates cached 'posts' reads.`;

const TESTING_USAGE = `import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNgQl } from 'ng-ql';

TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting(), provideNgQl({ baseUrl: '/api' }), PostResource],
});

const httpMock = TestBed.inject(HttpTestingController);
const posts = TestBed.inject(PostResource);

posts.all().subscribe();
httpMock.expectOne('/api/posts').flush([{ id: 1, title: 'Hello' }]);
httpMock.verify();`;

interface CachePolicyRow {
  readonly policy: string;
  readonly behavior: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlockComponent],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent {
  protected readonly install = INSTALL;
  protected readonly providerSetup = PROVIDER_SETUP;
  protected readonly model = MODEL;
  protected readonly resource = RESOURCE;
  protected readonly observableUsage = OBSERVABLE_USAGE;
  protected readonly signalUsage = SIGNAL_USAGE;
  protected readonly crudUsage = CRUD_USAGE;
  protected readonly testingUsage = TESTING_USAGE;

  protected readonly cachePolicies: readonly CachePolicyRow[] = [
    {
      policy: 'no-store',
      behavior: 'Always executes the request; never reads or writes the cache.',
    },
    {
      policy: 'cache-first',
      behavior: 'Returns valid cached data immediately if present; otherwise fetches.',
    },
    {
      policy: 'network-first',
      behavior: 'Fetches fresh data first; falls back to a cached value if the request fails.',
    },
    {
      policy: 'stale-while-revalidate',
      behavior: 'Returns cached data immediately (if any) while revalidating in the background.',
    },
  ];
}
