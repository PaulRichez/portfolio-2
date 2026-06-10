import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-properties';
import 'prismjs/components/prism-markdown';
import { FileLanguage } from '../models';

const PRISM_LANG: Record<string, string> = {
  typescript: 'typescript',
  json: 'json',
  dotenv: 'properties',
  markdown: 'markdown',
};

/** Vue "code" : gouttière de numéros de ligne + coloration Prism. */
@Component({
  selector: 'ide-code-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gutter">
      @for (n of lines(); track $index) {
        <span>{{ n }}</span>
      }
    </div>
    <pre class="code"><code [innerHTML]="highlighted()"></code></pre>
  `,
  styles: [`
    :host {
      display: flex; align-items: flex-start; font-family: var(--ide-mono);
      font-size: 13px; line-height: 19px; min-height: 100%;
    }
    .gutter {
      display: flex; flex-direction: column; flex: none; padding: 12px 0;
      width: 56px; text-align: right; color: var(--ide-gutter); user-select: none;
    }
    .gutter span { padding-right: 22px; }
    .code {
      flex: 1; margin: 0; padding: 12px 16px 12px 0; overflow-x: auto;
      background: transparent; color: var(--ide-editor-fg);
      white-space: pre; tab-size: 2;
    }
  `],
})
export class CodeViewComponent {
  readonly code = input.required<string>();
  readonly language = input.required<FileLanguage>();

  readonly lines = computed(() =>
    Array.from({ length: this.code().split('\n').length }, (_, i) => i + 1));

  readonly highlighted = computed(() => {
    const lang = PRISM_LANG[this.language()];
    const grammar = lang ? (Prism as any).languages[lang] : null;
    if (!grammar) return escapeHtml(this.code());
    return (Prism as any).highlight(this.code(), grammar, lang);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
