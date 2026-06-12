import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IdeStateService } from '../services/ide-state.service';

@Component({
  selector: 'ide-title-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lights">
      <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
    </div>
    <nav class="menus">
      <span>Fichier</span><span>Édition</span><span>Affichage</span><span>Aller</span><a
        class="menu-link" href="mailto:pro@paulrichez.fr?subject=Contact%20via%20portfolio"
        target="_blank" rel="noopener">Aide</a>
    </nav>
    <div class="title">{{ title() }}</div>
    <div class="actions">
      <button class="act" [class.active]="state.chatVisible()" (click)="state.toggleChat()"
              title="Assistant IA" aria-label="Assistant IA">
        <i class="codicon codicon-comment-discussion"></i>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex; align-items: center; height: 35px; flex: none;
      background: var(--ide-titlebar-bg); color: var(--ide-titlebar-fg);
      font-size: 12px; user-select: none; border-bottom: 1px solid var(--ide-border);
    }
    .lights { display: flex; gap: 8px; padding: 0 14px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }
    .menus { display: flex; gap: 4px; }
    .menus span, .menus .menu-link { padding: 4px 8px; border-radius: 4px; cursor: default; opacity: .85; }
    .menus .menu-link { color: inherit; text-decoration: none; cursor: pointer; }
    .menus span:hover, .menus .menu-link:hover { background: var(--ide-hover); }
    .title { flex: 1; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; opacity: .85; }
    .actions { width: 180px; display: flex; justify-content: flex-end; padding-right: 8px; }
    .act {
      display: flex; align-items: center; justify-content: center; width: 28px; height: 24px;
      background: none; border: none; cursor: pointer; color: inherit; border-radius: 4px; opacity: .8;
    }
    .act:hover { background: var(--ide-hover); opacity: 1; }
    .act.active { color: var(--ide-accent); opacity: 1; }
    .act .codicon { font-size: 16px; }
    @media (max-width: 768px) {
      .menus { display: none; }
      .actions { width: auto; }
      .title { text-align: right; padding-right: 8px; }
    }
  `],
})
export class TitleBarComponent {
  readonly state = inject(IdeStateService);

  readonly title = computed(() => {
    const active = this.state.activePath();
    const file = active ? active.split('/').pop() + ' — ' : '';
    return `${file}paul-richez — Visual Studio Code`;
  });
}
