import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IdeStateService } from '../services/ide-state.service';
import { ExplorerComponent } from './explorer.component';
import { ThemePickerComponent } from './theme-picker.component';

@Component({
  selector: 'ide-side-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExplorerComponent, ThemePickerComponent],
  template: `
    <header>
      <span>{{ state.sidebarPanel() === 'explorer' ? 'EXPLORATEUR' : 'THÈME DE COULEUR' }}</span>
      <button class="close" (click)="state.sidebarVisible.set(false)" aria-label="Fermer le panneau">
        <i class="codicon codicon-close"></i>
      </button>
    </header>
    <div class="content">
      @switch (state.sidebarPanel()) {
        @case ('explorer') { <ide-explorer /> }
        @case ('theme') { <ide-theme-picker /> }
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column;
      /* largeur souhaitée, mais plafonnée à 33% du viewport sur écran étroit */
      width: min(var(--ide-sidebar-w, 260px), 33vw); flex: none;
      background: var(--ide-sidebar-bg); border-right: 1px solid var(--ide-border);
      overflow: hidden;
    }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 8px 8px 16px; font-size: 11px; letter-spacing: .08em;
      color: var(--ide-sidebar-header); user-select: none; flex: none;
    }
    .close {
      background: none; border: none; cursor: pointer; color: inherit;
      padding: 2px; border-radius: 4px; display: none;
    }
    .close:hover { background: var(--ide-hover); }
    .content { flex: 1; overflow-y: auto; }

    @media (max-width: 768px) {
      :host {
        position: absolute; left: 48px; top: 0; bottom: 0; z-index: 30;
        width: min(280px, calc(100vw - 48px));
        box-shadow: 4px 0 12px rgba(0, 0, 0, .25);
      }
      .close { display: block; }
    }
  `],
})
export class SideBarComponent {
  readonly state = inject(IdeStateService);
}
