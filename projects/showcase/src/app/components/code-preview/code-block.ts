import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-code-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="code-block">
      <div class="code-block__bar">
        <span class="code-block__label">{{ label() }}</span>
        <button type="button" class="code-block__copy" (click)="copy()">
          {{ copied() ? 'Copied!' : 'Copy' }}
        </button>
      </div>
      <pre
        class="code-block__body"
        [style.maxHeight]="maxHeight()"
        [style.overflowY]="maxHeight() ? 'auto' : null"
      ><code>{{ code() }}</code></pre>
    </div>
  `,
  styles: [
    `
      .code-block {
        border: 1px solid var(--ngql-border);
        border-radius: 8px;
        overflow: hidden;
        background: var(--ngql-code-bg);
      }
      .code-block__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.4rem 0.75rem;
        background: var(--ngql-code-bar-bg);
        border-bottom: 1px solid var(--ngql-border);
      }
      .code-block__label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ngql-muted);
      }
      .code-block__copy {
        font-size: 0.75rem;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        border: 1px solid var(--ngql-border);
        background: var(--ngql-surface);
        color: var(--ngql-text);
        cursor: pointer;
      }
      .code-block__copy:hover {
        background: var(--ngql-surface-hover);
      }
      .code-block__body {
        margin: 0;
        padding: 0.85rem 1rem;
        overflow-x: auto;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 0.82rem;
        line-height: 1.5;
        color: var(--ngql-code-text);
        white-space: pre;
      }
    `,
  ],
})
export class CodeBlockComponent {
  readonly code = input.required<string>();
  readonly label = input<string>('code');
  /** Optional CSS max-height (e.g. `'420px'`) — enables vertical scrolling for long files. */
  readonly maxHeight = input<string | null>(null);
  protected readonly copied = signal(false);

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context); silently ignore.
    }
  }
}
