import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IdeStateService } from '../services/ide-state.service';
import { urlForFile } from '../models';
import { fileIcon } from '../ide-icons';

@Component({
  selector: 'ide-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (path of state.tabs(); track path) {
      <div class="tab" [class.active]="state.activePath() === path"
           (click)="activate(path)" (mousedown)="onMouseDown($event, path)" [title]="path">
        <i class="codicon" [class]="'codicon ' + icon(path).icon" [style.color]="icon(path).color"></i>
        <span class="name">{{ name(path) }}</span>
        <button class="close" (click)="close($event, path)" aria-label="Fermer l'onglet">
          <i class="codicon codicon-close"></i>
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex; align-items: stretch; height: 35px; flex: none;
      background: var(--ide-tabbar-bg); overflow-x: auto; overflow-y: hidden;
      user-select: none; scrollbar-width: thin;
    }
    .tab {
      display: flex; align-items: center; gap: 6px; padding: 0 6px 0 10px;
      font-size: 13px; color: var(--ide-tab-fg); background: var(--ide-tab-inactive-bg);
      border-right: 1px solid var(--ide-border); border-top: 1px solid transparent;
      cursor: pointer; white-space: nowrap; flex: none;
    }
    .tab.active {
      background: var(--ide-tab-active-bg); color: var(--ide-tab-active-fg);
      border-top-color: var(--ide-accent);
    }
    .codicon { font-size: 14px; }
    .close {
      display: flex; align-items: center; background: none; border: none; cursor: pointer;
      color: inherit; padding: 2px; border-radius: 4px; opacity: 0;
    }
    .tab:hover .close, .tab.active .close { opacity: .8; }
    .close:hover { background: var(--ide-hover); opacity: 1; }
    .close .codicon { font-size: 13px; }
  `],
})
export class TabBarComponent {
  readonly state = inject(IdeStateService);
  private readonly router = inject(Router);

  name(path: string): string { return path.split('/').pop() ?? path; }
  icon(path: string) { return fileIcon(this.name(path)); }

  activate(path: string): void {
    this.router.navigateByUrl(urlForFile(path));
  }

  /** Clic molette (bouton du milieu) sur un onglet = fermeture, comme VS Code. */
  onMouseDown(event: MouseEvent, path: string): void {
    if (event.button === 1) {
      event.preventDefault(); // évite le défilement automatique du bouton du milieu
      this.closeTab(path);
    }
  }

  close(event: MouseEvent, path: string): void {
    event.stopPropagation();
    this.closeTab(path);
  }

  private closeTab(path: string): void {
    const next = this.state.close(path);
    this.router.navigateByUrl(next ? urlForFile(next) : '/');
  }
}
