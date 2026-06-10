import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { ThemeService } from '../services/theme.service';
import { LANGUAGE_LABELS } from '../ide-icons';

@Component({
  selector: 'ide-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="left">
      <span class="item"><i class="codicon codicon-source-control"></i> main</span>
      <span class="item"><i class="codicon codicon-broadcast"></i> open to work</span>
    </div>
    <div class="right">
      @if (lineCount(); as lines) {
        <span class="item dim">Ln {{ lines }}, Col 1</span>
      }
      <span class="item dim">UTF-8</span>
      @if (language()) {
        <span class="item">{{ language() }}</span>
      }
      <button class="item btn" (click)="state.togglePanel('theme')" title="Changer de thème">
        <i class="codicon codicon-color-mode"></i> {{ themeLabel() }}
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex; align-items: center; justify-content: space-between;
      height: 22px; flex: none; padding: 0 10px;
      background: var(--ide-statusbar-bg); color: var(--ide-statusbar-fg);
      font-size: 12px; user-select: none;
    }
    .left, .right { display: flex; align-items: center; gap: 2px; }
    .item { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; height: 22px; }
    .codicon { font-size: 14px; }
    .btn { background: none; border: none; color: inherit; cursor: pointer; font-size: 12px; }
    .btn:hover, .item:not(.dim):hover { background: rgba(255, 255, 255, .12); }
    @media (max-width: 768px) { .dim { display: none; } }
  `],
})
export class StatusBarComponent {
  readonly state = inject(IdeStateService);
  private readonly vfs = inject(VfsService);
  private readonly theme = inject(ThemeService);

  readonly lineCount = computed(() => {
    const path = this.state.activePath();
    if (!path) return 0;
    const file = this.vfs.getFile(path);
    return file && file.language !== 'pdf' ? file.content.split('\n').length : 0;
  });

  readonly language = computed(() => {
    const path = this.state.activePath();
    if (!path) return '';
    const file = this.vfs.getFile(path);
    return file ? LANGUAGE_LABELS[file.language] : '';
  });

  readonly themeLabel = computed(() => {
    const mode = this.theme.mode();
    return mode === 'system' ? 'Auto' : mode === 'dark' ? 'Dark+' : 'Light+';
  });
}
