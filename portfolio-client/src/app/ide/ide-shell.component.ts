import { ChangeDetectionStrategy, Component, HostListener, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TitleBarComponent } from './components/title-bar.component';
import { ActivityBarComponent } from './components/activity-bar.component';
import { SideBarComponent } from './components/side-bar.component';
import { TabBarComponent } from './components/tab-bar.component';
import { EditorComponent } from './components/editor.component';
import { StatusBarComponent } from './components/status-bar.component';
import { ChatPanelComponent } from './components/chat-panel.component';
import { ResizeHandleComponent } from './components/resize-handle.component';
import { CommandPaletteComponent } from './components/command-palette.component';
import { IdeStateService } from './services/ide-state.service';
import { ThemeService } from './services/theme.service';
import { VfsService } from './services/vfs.service';
import { ROOT_FILE, urlForFile } from './models';

@Component({
  selector: 'ide-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleBarComponent, ActivityBarComponent, SideBarComponent, TabBarComponent,
    EditorComponent, StatusBarComponent, ChatPanelComponent, ResizeHandleComponent,
    CommandPaletteComponent,
  ],
  template: `
    <ide-title-bar />
    <div class="main">
      <ide-activity-bar />
      @if (state.sidebarVisible()) {
        <ide-side-bar [style.--ide-sidebar-w.px]="state.sidebarWidth()" />
        <ide-resize-handle [width]="state.sidebarWidth()" [min]="180" [max]="500"
                           side="right" (widthChange)="state.setSidebarWidth($event)" />
      }
      <div class="editor-zone">
        <ide-tab-bar />
        <ide-editor />
      </div>
      @if (state.chatVisible()) {
        <ide-resize-handle [width]="state.chatWidth()" [min]="300" [max]="620"
                           side="left" (widthChange)="state.setChatWidth($event)" />
        <ide-chat-panel [style.--ide-chat-w.px]="state.chatWidth()" />
      }
    </div>
    <ide-status-bar />
    @if (state.paletteOpen()) {
      <ide-command-palette />
    }
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column; height: 100dvh;
      font-family: var(--ide-font); overflow: hidden;
      background: var(--ide-editor-bg);
    }
    .main { display: flex; flex: 1; min-height: 0; position: relative; }
    .editor-zone { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  `],
})
export class IdeShellComponent {
  readonly state = inject(IdeStateService);
  private readonly vfs = inject(VfsService);
  private readonly router = inject(Router);
  // instancié ici pour appliquer le thème dès le chargement
  private readonly theme = inject(ThemeService);

  /** Premier chargement : '' redirige vers README.md ; ensuite '' = éditeur vide. */
  private booted = false;
  private pendingUrl = '/';

  constructor() {
    this.vfs.load();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => { this.pendingUrl = e.urlAfterRedirects; this.process(); });
    // le VFS arrive de l'API : on (re)traite l'URL une fois les fichiers chargés
    effect(() => { if (this.vfs.loaded()) this.process(); });
  }

  /** Raccourcis : Ctrl/Cmd+B = explorateur, Ctrl/Cmd+Alt+B = chat, Échap = ferme le panneau actif. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (ctrl && e.altKey && key === 'b') { e.preventDefault(); this.state.toggleChat(); }
    else if (ctrl && key === 'b') { e.preventDefault(); this.state.toggleSidebar(); }
    else if (ctrl && key === 'p') { e.preventDefault(); this.state.paletteOpen.set(true); }
    else if (key === 'escape' && typeof window !== 'undefined' && window.innerWidth <= 768) {
      if (this.state.chatVisible()) this.state.chatVisible.set(false);
      else if (this.state.sidebarVisible()) this.state.sidebarVisible.set(false);
    }
  }

  /** Traite la dernière URL connue, mais seulement quand le VFS est prêt. */
  private process(): void {
    if (this.vfs.loaded()) this.syncFromUrl(this.pendingUrl);
  }

  private syncFromUrl(url: string): void {
    const clean = decodeURIComponent(url.split('?')[0].split('#')[0]);
    if (clean === '/' || clean === '') {
      // racine : au 1er chargement on ouvre le README (à son URL /README) ;
      // ensuite (ex. dernier onglet fermé) on laisse l'éditeur vide.
      if (!this.booted) {
        this.booted = true;
        this.router.navigateByUrl(urlForFile(ROOT_FILE), { replaceUrl: true });
      }
      return;
    }
    this.booted = true;
    const path = this.vfs.pathForUrl(clean);
    if (path) {
      this.state.open(path);
    } else {
      this.router.navigateByUrl(urlForFile(ROOT_FILE), { replaceUrl: true });
    }
  }
}
