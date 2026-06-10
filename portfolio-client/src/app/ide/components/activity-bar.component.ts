import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IdeStateService } from '../services/ide-state.service';

@Component({
  selector: 'ide-activity-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="top">
      <button class="item" [class.active]="isActive('explorer')" (click)="state.togglePanel('explorer')"
              title="Explorateur" aria-label="Explorateur">
        <i class="codicon codicon-files"></i>
      </button>
      <button class="item" [class.active]="isActive('theme')" (click)="state.togglePanel('theme')"
              title="Thème de couleur" aria-label="Thème de couleur">
        <i class="codicon codicon-symbol-color"></i>
      </button>
    </div>
    <div class="bottom">
      <a class="item" href="https://github.com/PaulRichez" target="_blank" rel="noopener" title="GitHub">
        <i class="codicon codicon-github-inverted"></i>
      </a>
      <a class="item" href="https://www.linkedin.com/in/paul-richez/" target="_blank" rel="noopener" title="LinkedIn">
        <i class="pi pi-linkedin"></i>
      </a>
    </div>
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column; justify-content: space-between;
      width: 48px; flex: none; background: var(--ide-activitybar-bg); user-select: none;
    }
    .top, .bottom { display: flex; flex-direction: column; }
    .item {
      display: flex; align-items: center; justify-content: center;
      width: 48px; height: 48px; background: none; border: none; cursor: pointer;
      color: var(--ide-activitybar-fg); border-left: 2px solid transparent;
      text-decoration: none;
    }
    .item:hover { color: var(--ide-activitybar-active); }
    .item.active { color: var(--ide-activitybar-active); border-left-color: var(--ide-activitybar-active); }
    .codicon { font-size: 24px; }
    .pi { font-size: 20px; }
  `],
})
export class ActivityBarComponent {
  readonly state = inject(IdeStateService);

  isActive(panel: 'explorer' | 'theme'): boolean {
    return this.state.sidebarPanel() === panel && this.state.sidebarVisible();
  }
}
