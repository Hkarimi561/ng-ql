import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EnvironmentInjector,
  computed,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import type { NgQlCachePolicy, NgQlPaginatedRequestState, NgQlResource } from 'ng-ql';

import { CodeBlockComponent } from './components/code-preview/code-block';
import { generateCode, generateMutationCode, type MutationAction } from './code-gen';
import { PostManagerComponent } from './examples/post-manager.component';
import { ProductManagerComponent } from './examples/product-manager.component';
import { EXAMPLE_SOURCES } from './examples/source-code';
import { UserManagerComponent } from './examples/user-manager.component';
import { RESOURCE_DEFS, type ResourceKind } from './models/domain';
import { OPERATORS, type UiWhereClause } from './models/ui-state';
import { PostResource } from './resources/post-resource';
import { ProductResource } from './resources/product-resource';
import { UserResource } from './resources/user-resource';
import { MockApiService } from './services/mock-api.service';

type ShowcaseView = 'console' | 'examples';
type ExampleViewMode = 'demo' | 'code';

type Row = Record<string, unknown>;

const CACHE_POLICIES: readonly NgQlCachePolicy[] = [
  'no-store',
  'cache-first',
  'network-first',
  'stale-while-revalidate',
];

let whereIdSeq = 0;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CodeBlockComponent,
    PostManagerComponent,
    UserManagerComponent,
    ProductManagerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly injector = inject(EnvironmentInjector);
  private readonly postResource = inject(PostResource);
  private readonly userResource = inject(UserResource);
  private readonly productResource = inject(ProductResource);
  protected readonly mock = inject(MockApiService);

  /** Which top-level tab is showing: the interactive console, or the real example components. */
  protected readonly activeView = signal<ShowcaseView>('console');
  /** Which example component is showing inside the "Component Examples" tab. */
  protected readonly exampleResource = signal<ResourceKind>('posts');
  /** Inside "Component Examples": the live running component, or its full source. */
  protected readonly exampleViewMode = signal<ExampleViewMode>('demo');
  /** Which source file is focused in the "Code" view. */
  protected readonly exampleFileIndex = signal(0);

  protected readonly exampleSourceSet = computed(() => EXAMPLE_SOURCES[this.exampleResource()]);

  protected readonly resourceKinds = Object.values(RESOURCE_DEFS);
  protected readonly operators = OPERATORS;
  protected readonly cachePolicies = CACHE_POLICIES;
  protected readonly viewMode = signal<'table' | 'json'>('table');

  protected readonly resourceKind = signal<ResourceKind>('posts');
  protected readonly wheres = signal<UiWhereClause[]>([]);
  protected readonly includes = signal<string[]>([]);
  protected readonly selectedFields = signal<string[]>([]);
  protected readonly sortField = signal('createdAt');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');
  protected readonly page = signal(1);
  protected readonly perPage = signal(10);
  protected readonly cachePolicy = signal<NgQlCachePolicy>('no-store');

  protected readonly requestState = signal<NgQlPaginatedRequestState<Row> | null>(null);

  // -- Mutations (create / update / patch / destroy) -----------------------
  protected readonly mutationId = signal('');
  protected readonly mutationForm = signal<Record<string, string>>({});
  protected readonly mutationAction = signal<MutationAction>('create');
  protected readonly mutationStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly mutationError = signal<unknown>(null);
  protected readonly mutationResult = signal<unknown>(null);

  protected readonly resourceDef = computed(() => RESOURCE_DEFS[this.resourceKind()]);

  protected readonly generatedCode = computed(() =>
    generateCode({
      resourceKind: this.resourceKind(),
      wheres: this.wheres(),
      includes: this.includes(),
      selectedFields: this.selectedFields(),
      sortField: this.sortField(),
      sortDir: this.sortDir(),
      page: this.page(),
      perPage: this.perPage(),
      cachePolicy: this.cachePolicy(),
    }),
  );

  protected readonly previewUrl = computed(() => this.buildQuery().toUrl());

  protected readonly previewParams = computed(() => {
    const params = this.buildQuery().toQueryParams();
    return params
      .keys()
      .flatMap((key) => (params.getAll(key) ?? []).map((value) => ({ key, value })));
  });

  protected readonly canExecute = computed(() => !!this.resourceKind());

  protected readonly displayColumns = computed(() =>
    this.selectedFields().length > 0
      ? this.selectedFields()
      : this.resourceDef().fields.map((f) => f.name),
  );

  protected readonly mutationFields = computed(() =>
    this.resourceDef().fields.filter((f) => f.name !== 'id'),
  );

  protected readonly mutationCode = computed(() =>
    generateMutationCode({
      resourceKind: this.resourceKind(),
      action: this.mutationAction(),
      id: this.mutationId(),
      fields: this.mutationForm(),
    }),
  );

  private resourceFor(kind: ResourceKind): NgQlResource<Row, number> {
    const map: Record<ResourceKind, NgQlResource<Row, number>> = {
      posts: this.postResource as unknown as NgQlResource<Row, number>,
      users: this.userResource as unknown as NgQlResource<Row, number>,
      products: this.productResource as unknown as NgQlResource<Row, number>,
    };
    return map[kind];
  }

  private buildQuery() {
    let query = this.resourceFor(this.resourceKind()).query();

    for (const where of this.wheres()) {
      if (!where.field || where.value === '') continue;
      query = query.where(where.field, where.operator, coerceValue(where.value));
    }

    if (this.selectedFields().length > 0) {
      query = query.select(this.selectedFields());
    }

    if (this.includes().length > 0) {
      query = query.with(this.includes());
    }

    if (this.sortField()) {
      query = query.orderBy(this.sortField(), this.sortDir());
    }

    return query;
  }

  selectExampleResource(kind: ResourceKind): void {
    this.exampleResource.set(kind);
    this.exampleFileIndex.set(0);
  }

  selectResource(kind: ResourceKind): void {
    this.resourceKind.set(kind);
    this.wheres.set([]);
    this.includes.set([]);
    this.selectedFields.set([]);
    this.sortField.set('createdAt');
    this.sortDir.set('desc');
    this.page.set(1);
    this.requestState.set(null);
    this.resetMutationForm();
  }

  addWhere(): void {
    const field = this.resourceDef().fields[0]?.name ?? '';
    this.wheres.update((list) => [...list, { id: whereIdSeq++, field, operator: '=', value: '' }]);
  }

  removeWhere(id: number): void {
    this.wheres.update((list) => list.filter((w) => w.id !== id));
  }

  updateWhere(id: number, patch: Partial<UiWhereClause>): void {
    this.wheres.update((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  toggleInclude(relation: string): void {
    this.includes.update((list) =>
      list.includes(relation) ? list.filter((r) => r !== relation) : [...list, relation],
    );
  }

  toggleField(field: string): void {
    this.selectedFields.update((list) =>
      list.includes(field) ? list.filter((f) => f !== field) : [...list, field],
    );
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.page.set(page);
    this.requestState()?.setPage(page);
  }

  setPerPage(perPage: number): void {
    if (perPage < 1) return;
    this.perPage.set(perPage);
    this.requestState()?.setPerPage(perPage);
  }

  execute(): void {
    const query = this.buildQuery();
    const state = runInInjectionContext(this.injector, () =>
      query.paginateSignal(this.page(), this.perPage(), { cache: this.cachePolicy() }),
    );
    this.requestState.set(state as unknown as NgQlPaginatedRequestState<Row>);
  }

  refresh(): void {
    this.requestState()?.refresh();
  }

  invalidate(): void {
    this.requestState()?.invalidate();
  }

  reset(): void {
    this.selectResource(this.resourceKind());
    this.cachePolicy.set('no-store');
  }

  // -- Mutations ------------------------------------------------------------

  setMutationField(field: string, value: string): void {
    this.mutationForm.update((form) => ({ ...form, [field]: value }));
  }

  /** Populates the mutation form from a clicked response row, for quick update/patch/delete. */
  selectRowForMutation(row: Row): void {
    const id = row['id'];
    this.mutationId.set(id === undefined || id === null ? '' : String(id));

    const form: Record<string, string> = {};
    for (const field of this.mutationFields()) {
      const value = row[field.name];
      form[field.name] = value === undefined || value === null ? '' : String(value);
    }
    this.mutationForm.set(form);
  }

  resetMutationForm(): void {
    this.mutationId.set('');
    this.mutationForm.set({});
    this.mutationStatus.set('idle');
    this.mutationError.set(null);
    this.mutationResult.set(null);
  }

  runCreate(): void {
    this.mutationAction.set('create');
    this.runMutation(
      this.resourceFor(this.resourceKind()).create(this.buildPayload({ includeEmpty: true })),
    );
  }

  runUpdate(): void {
    const id = this.parsedMutationId();
    if (id === null) return;
    this.mutationAction.set('update');
    this.runMutation(
      this.resourceFor(this.resourceKind()).update(id, this.buildPayload({ includeEmpty: true })),
    );
  }

  runPatch(): void {
    const id = this.parsedMutationId();
    if (id === null) return;
    this.mutationAction.set('patch');
    this.runMutation(
      this.resourceFor(this.resourceKind()).patch(id, this.buildPayload({ includeEmpty: false })),
    );
  }

  runDestroy(): void {
    const id = this.parsedMutationId();
    if (id === null) return;
    this.mutationAction.set('destroy');
    this.runMutation(this.resourceFor(this.resourceKind()).destroy(id));
  }

  private runMutation(request: Observable<unknown>): void {
    this.mutationStatus.set('loading');
    this.mutationError.set(null);
    this.mutationResult.set(null);

    request.subscribe({
      next: (result) => {
        this.mutationStatus.set('success');
        this.mutationResult.set(result ?? { deleted: true });
        // Cache invalidation already happened inside ng-ql; refresh the visible query, if any.
        this.requestState()?.refresh();
      },
      error: (error: unknown) => {
        this.mutationStatus.set('error');
        this.mutationError.set(error);
      },
    });
  }

  private parsedMutationId(): number | null {
    const raw = this.mutationId().trim();
    if (raw === '' || Number.isNaN(Number(raw))) return null;
    return Number(raw);
  }

  private buildPayload(options: { includeEmpty: boolean }): Row {
    const form = this.mutationForm();
    const payload: Row = {};
    for (const field of this.mutationFields()) {
      const raw = form[field.name];
      if (raw === undefined || raw === '') {
        if (options.includeEmpty) payload[field.name] = coerceValue(raw ?? '');
        continue;
      }
      payload[field.name] = coerceValue(raw);
    }
    return payload;
  }

  errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string } | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
      return `${error.status} ${error.statusText}`;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async copyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.previewUrl());
    } catch {
      // Clipboard API unavailable; ignore.
    }
  }
}

function coerceValue(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}
