import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../services/theme.service';
import { ThemeMode } from '../models';

@Component({
  selector: 'ide-theme-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (option of options; track option.mode) {
      <div class="option" [class.active]="theme.mode() === option.mode" (click)="theme.setMode(option.mode)">
        <span class="swatch" [attr.data-mode]="option.mode"></span>
        <span class="labels">
          <span class="label">{{ option.label }}</span>
          <span class="hint">{{ option.hint }}</span>
        </span>
        @if (theme.mode() === option.mode) {
          <i class="codicon codicon-check"></i>
        }
      </div>
    }
    <p class="note">Le thème est mémorisé sur cet appareil.</p>
  `,
  styles: [`
    :host { display: block; padding: 4px; font-size: 13px; color: var(--ide-sidebar-fg); user-select: none; }
    .option {
      display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 4px; cursor: pointer;
    }
    .option:hover { background: var(--ide-hover); }
    .option.active { background: var(--ide-selection); }
    .swatch {
      width: 28px; height: 20px; border-radius: 3px; flex: none; border: 1px solid var(--ide-border);
    }
    .swatch[data-mode="dark"] { background: #1e1e1e; }
    .swatch[data-mode="light"] { background: #ffffff; }
    .swatch[data-mode="system"] { background: linear-gradient(110deg, #1e1e1e 50%, #ffffff 50%); }
    .labels { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .label { font-weight: 600; }
    .hint { font-size: 11px; opacity: .7; }
    .codicon { color: var(--ide-accent); }
    .note { padding: 10px 8px; font-size: 11px; opacity: .6; }
  `],
})
export class ThemePickerComponent {
  readonly theme = inject(ThemeService);

  readonly options: { mode: ThemeMode; label: string; hint: string }[] = [
    { mode: 'system', label: 'Système', hint: 'Suit les préférences de votre appareil' },
    { mode: 'dark', label: 'Dark+', hint: 'Thème sombre VS Code' },
    { mode: 'light', label: 'Light+', hint: 'Thème clair VS Code' },
  ];
}
