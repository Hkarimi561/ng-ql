import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgQl } from 'ng-ql';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApiInterceptor } from '../mock/mock-api.interceptor';
import { PostResource } from '../resources/post-resource';
import { MockApiService } from '../services/mock-api.service';
import { PostManagerComponent } from './post-manager.component';

function clickButton(
  fixture: ComponentFixture<PostManagerComponent>,
  text: string,
  index = 0,
): void {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).filter(
    (btn): btn is HTMLButtonElement =>
      btn instanceof HTMLButtonElement && btn.textContent?.trim() === text,
  );
  const button = buttons[index];
  if (!button) throw new Error(`Button "${text}" (index ${index}) not found`);
  button.click();
  fixture.detectChanges();
}

describe('PostManagerComponent', () => {
  let fixture: ComponentFixture<PostManagerComponent>;
  let posts: PostResource;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostManagerComponent],
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideNgQl({ baseUrl: '/api' }),
      ],
    }).compileComponents();

    // Disable simulated latency/errors so assertions never need to race a timer.
    TestBed.inject(MockApiService).enabled.set(false);
    posts = TestBed.inject(PostResource);

    fixture = TestBed.createComponent(PostManagerComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('lists posts from the resource on init', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.post-card').length).toBeGreaterThan(0);
  });

  it('opens the create form and calls PostResource.create() on submit', () => {
    const createSpy = vi.spyOn(posts, 'create').mockReturnValue(
      of({
        id: 999,
        title: '',
        status: 'draft',
        categoryId: 1,
        authorId: 1,
        views: 0,
        createdAt: '',
      }),
    );

    clickButton(fixture, '+ New post');
    expect(fixture.nativeElement.querySelector('input[name="title"]')).toBeTruthy();

    clickButton(fixture, 'Create post');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy.mock.calls[0][0]).toMatchObject({ status: 'draft' });
  });

  it('publishes a draft post with a single click (PATCH)', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const draftCard = Array.from(compiled.querySelectorAll('.post-card')).find((card) =>
      card.textContent?.includes('draft'),
    );
    expect(draftCard).toBeTruthy();
    const originalTitle = draftCard!.querySelector('.post-card__title')?.textContent;

    const publishButton = Array.from(draftCard!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Publish',
    ) as HTMLButtonElement;
    publishButton.click();
    fixture.detectChanges();

    const updatedCard = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.post-card'),
    ).find((card) => card.querySelector('.post-card__title')?.textContent === originalTitle);
    expect(updatedCard?.textContent).toContain('published');
  });

  it('opens the edit form pre-filled, and calls PostResource.update() on submit', async () => {
    const firstCard = fixture.nativeElement.querySelector('.post-card') as HTMLElement;
    const title = firstCard.querySelector('.post-card__title')?.textContent ?? '';

    const updateSpy = vi
      .spyOn(posts, 'update')
      .mockReturnValue(
        of({ id: 1, title, status: 'draft', categoryId: 1, authorId: 1, views: 0, createdAt: '' }),
      );

    (
      Array.from(firstCard.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Edit',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    // NgModel writes the pre-filled value into the DOM asynchronously; let it settle.
    await fixture.whenStable();
    fixture.detectChanges();

    const titleInput = fixture.nativeElement.querySelector(
      'input[name="title"]',
    ) as HTMLInputElement;
    expect(titleInput.value).toBe(title);

    clickButton(fixture, 'Save changes');

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][1]).toMatchObject({ title });
  });

  it('deletes a post', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const firstCard = compiled.querySelector('.post-card');
    const title = firstCard?.querySelector('.post-card__title')?.textContent;
    expect(title).toBeTruthy();

    clickButton(fixture, 'Delete');

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(title);
  });
});
