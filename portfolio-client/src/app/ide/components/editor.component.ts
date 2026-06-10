import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { MarkdownBlockComponent } from '../../shared/components/markdown-block.component';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { CodeViewComponent } from './code-view.component';
import { ROOT_FILE, urlForFile } from '../models';

@Component({
  selector: 'ide-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownBlockComponent, CodeViewComponent],
  template: `
    @if (file(); as f) {
      <div class="toolbar">
        <nav class="breadcrumb">
          @for (part of breadcrumb(); track $index) {
            @if (!$first) { <i class="codicon codicon-chevron-right"></i> }
            <span>{{ part }}</span>
          }
        </nav>
        @if (f.language === 'markdown') {
          <button class="action" (click)="togglePreview()"
                  [title]="preview() ? 'Afficher la source' : 'Aperçu'">
            <i class="codicon" [class.codicon-code]="preview()" [class.codicon-open-preview]="!preview()"></i>
          </button>
        }
      </div>
      <div class="content">
        @if (f.language === 'pdf') {
          <div class="pdf-bar">
            <a class="download" [href]="cvUrl" target="_blank" rel="noopener">
              <i class="codicon codicon-cloud-download"></i> Télécharger le CV
            </a>
          </div>
          <iframe [src]="pdfSrc" title="CV PDF"></iframe>
        } @else if (f.language === 'markdown' && preview()) {
          <div class="ide-markdown">
            <app-markdown-block [markdown]="f.content" />
          </div>
        } @else {
          <ide-code-view [code]="f.content" [language]="f.language" />
        }
      </div>
    } @else if (vfs.failed()) {
      <div class="empty">
        <i class="codicon codicon-debug-disconnect watermark"></i>
        <p>Impossible de charger le contenu</p>
        <small>L'API du portfolio est injoignable.</small>
      </div>
    } @else if (!vfs.loaded()) {
      <div class="empty">
        <i class="codicon codicon-loading codicon-modifier-spin watermark"></i>
        <p>Chargement du workspace…</p>
      </div>
    } @else {
      <div class="empty">
        <i class="codicon codicon-code watermark"></i>
        <p>Aucun fichier ouvert</p>
        <button (click)="openReadme()">
          <i class="codicon codicon-markdown"></i> Ouvrir README.md
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column; flex: 1; min-height: 0;
      background: var(--ide-editor-bg); color: var(--ide-editor-fg);
    }
    .toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 12px; flex: none; font-size: 12px; color: var(--ide-editor-muted);
    }
    .breadcrumb { display: flex; align-items: center; gap: 2px; }
    .breadcrumb .codicon { font-size: 14px; opacity: .6; }
    .action {
      background: none; border: none; cursor: pointer; color: var(--ide-editor-muted);
      padding: 3px 5px; border-radius: 4px;
    }
    .action:hover { background: var(--ide-hover); color: var(--ide-editor-fg); }
    .action .codicon { font-size: 16px; }
    .content { flex: 1; overflow: auto; min-height: 0; display: flex; flex-direction: column; }
    .content > ide-code-view { flex: 1; }
    .ide-markdown { padding: 12px 32px 48px; max-width: 880px; }
    .pdf-bar { padding: 8px 16px; flex: none; }
    .download {
      display: inline-flex; align-items: center; gap: 6px; font-size: 13px;
      color: var(--ide-accent); text-decoration: none;
    }
    .download:hover { text-decoration: underline; }
    iframe { flex: 1; border: none; width: 100%; }
    .empty {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; color: var(--ide-editor-muted);
    }
    .watermark { font-size: 96px; opacity: .15; }
    .empty small { opacity: .6; font-size: 12px; }
    .empty button {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px;
      background: var(--ide-accent); color: #fff; border: none; border-radius: 4px;
      cursor: pointer; font-size: 13px;
    }
  `],
})
export class EditorComponent {
  private readonly state = inject(IdeStateService);
  readonly vfs = inject(VfsService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly cvUrl = `${environment.apiUrl}/me/cv`;
  readonly pdfSrc: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.cvUrl);

  readonly preview = signal(true);

  readonly file = computed(() => {
    const path = this.state.activePath();
    return path ? this.vfs.getFile(path) : null;
  });

  readonly breadcrumb = computed(() => this.state.activePath()?.split('/') ?? []);

  constructor() {
    // retour au mode aperçu à chaque changement de fichier
    effect(() => { this.state.activePath(); this.preview.set(true); });
  }

  togglePreview(): void { this.preview.update((v) => !v); }

  openReadme(): void { this.router.navigateByUrl(urlForFile(ROOT_FILE)); }
}
