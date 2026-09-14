import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgQl } from 'ng-ql';
import { App } from './app';
import { mockApiInterceptor } from './mock/mock-api.interceptor';

function clickButton(fixture: ComponentFixture<App>, text: string): void {
  const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
    (btn): btn is HTMLButtonElement =>
      btn instanceof HTMLButtonElement && btn.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Button "${text}" not found`);
  button.click();
  fixture.detectChanges();
}

function setInputValue(fixture: ComponentFixture<App>, selector: string, value: string): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
  if (!input) throw new Error(`Input "${selector}" not found`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

async function settle(ms = 500): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideRouter([]),
        provideNgQl({ baseUrl: '/api' }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the resource tabs', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Posts');
    expect(compiled.textContent).toContain('Users');
    expect(compiled.textContent).toContain('Products');
  });

  it('runs a query and renders results using the mock API', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const executeButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (btn): btn is HTMLButtonElement =>
        btn instanceof HTMLButtonElement && btn.textContent?.trim() === 'Execute',
    );
    executeButton?.click();

    await new Promise((resolve) => setTimeout(resolve, 500));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.data-table, .json-view')).toBeTruthy();
  });

  it('creates a resource via POST', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    clickButton(fixture, 'POST — Create');
    await settle();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.mutations .status-badge');
    expect(badge?.textContent?.trim()).toBe('success');
    expect(fixture.nativeElement.querySelector('.mutations .json-view')).toBeTruthy();
  });

  it('updates a resource via PUT', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    setInputValue(fixture, '.mutation-id', '1');
    clickButton(fixture, 'PUT — Update');
    await settle();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.mutations .status-badge');
    expect(badge?.textContent?.trim()).toBe('success');
  });

  it('partially updates a resource via PATCH', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    setInputValue(fixture, '.mutation-id', '1');
    clickButton(fixture, 'PATCH — Partial update');
    await settle();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.mutations .status-badge');
    expect(badge?.textContent?.trim()).toBe('success');
  });

  it('deletes a resource via DELETE', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    setInputValue(fixture, '.mutation-id', '2');
    clickButton(fixture, 'DELETE');
    await settle();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.mutations .status-badge');
    expect(badge?.textContent?.trim()).toBe('success');
  });

  it('switches to the Component examples tab and renders the real Post manager', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    clickButton(fixture, 'Component examples');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-post-manager')).toBeTruthy();
    expect(compiled.textContent).toContain('PostResource');
  });

  it('shows the full model/service/component/template source in the Code view', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    clickButton(fixture, 'Component examples');
    clickButton(fixture, 'Code');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('post.model.ts');
    expect(compiled.textContent).toContain('post-resource.ts');
    expect(compiled.textContent).toContain('post-manager.component.ts');
    expect(compiled.textContent).toContain('post-manager.component.html');
    // The model tab is selected by default; its actual interface body should render.
    expect(compiled.textContent).toContain("status: 'draft' | 'published' | 'archived'");

    clickButton(fixture, 'post-resource.ts');
    expect(compiled.textContent).toContain('extends NgQlResource<Post, number>');
  });

  it('reports an error status when a mutation targets a missing id', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    setInputValue(fixture, '.mutation-id', '999999');
    clickButton(fixture, 'PUT — Update');
    await settle();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.mutations .status-badge');
    expect(badge?.textContent?.trim()).toBe('error');
    expect(fixture.nativeElement.querySelector('.mutations .error-banner')).toBeTruthy();
  });
});
