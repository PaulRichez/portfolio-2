import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { VfsNode, urlForFile } from '../models';
import { fileIcon } from '../ide-icons';

/** Command palette façon VS Code (Ctrl/Cmd+P) : ouverture rapide de fichier. */
@Component({
  selector: 'ide-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="close()"></div>
    <div class="palette" role="dialog">
      <input #input type="text" placeholder="Aller au fichier…  (↑↓ pour naviguer, ↵ pour ouvrir)"
             [value]="query()" (input)="onInput($event)" (keydown)="onKey($event)" />
      <div class="results">
        @for (f of filtered(); track f.path; let i = $index) {
          <div class="row" [class.active]="i === active()"
               (mouseenter)="active.set(i)" (click)="open(f.path)">
            <i class="codicon" [class]="'codicon ' + icon(f).icon" [style.color]="icon(f).color"></i>
            <span class="name">{{ f.name }}</span>
            <span class="dir">{{ dir(f.path) }}</span>
          </div>
        } @empty {
          <div class="none">Aucun fichier</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 100; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.35); }
    .palette {
      position: absolute; top: 12%; left: 50%; transform: translateX(-50%);
      width: min(560px, 92vw); background: var(--ide-sidebar-bg);
      border: 1px solid var(--ide-border); border-radius: 8px; overflow: hidden;
      box-shadow: 0 12px 40px rgba(0,0,0,.4); display: flex; flex-direction: column;
    }
    input {
      border: none; outline: none; padding: 12px 14px; font-size: 14px; font-family: inherit;
      background: var(--ide-editor-bg); color: var(--ide-editor-fg);
      border-bottom: 1px solid var(--ide-border);
    }
    .results { max-height: 320px; overflow-y: auto; padding: 4px; }
    .row {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 5px;
      cursor: pointer; font-size: 13px; color: var(--ide-sidebar-fg);
    }
    .row.active { background: var(--ide-selection); }
    .row .codicon { font-size: 15px; flex: none; }
    .name { flex: none; }
    .dir { opacity: .55; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .none { padding: 14px; text-align: center; opacity: .6; font-size: 13px; }
  `],
})
export class CommandPaletteComponent {
  private readonly state = inject(IdeStateService);
  private readonly vfs = inject(VfsService);
  private readonly router = inject(Router);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly query = signal('');
  readonly active = signal(0);

  private readonly allFiles = computed<VfsNode[]>(() => {
    const out: VfsNode[] = [];
    const walk = (ns: VfsNode[]) => ns.forEach((n) => (n.type === 'file' ? out.push(n) : n.children && walk(n.children)));
    walk(this.vfs.tree());
    return out;
  });

  readonly filtered = computed<VfsNode[]>(() => {
    const q = this.query().toLowerCase().trim();
    const files = this.allFiles();
    if (!q) return files.slice(0, 50);
    return files.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 50);
  });

  constructor() {
    afterNextRender(() => this.input()?.nativeElement.focus());
  }

  icon(f: VfsNode) { return fileIcon(f.name); }
  dir(path: string) { const i = path.lastIndexOf('/'); return i >= 0 ? path.slice(0, i) : ''; }

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  onKey(e: KeyboardEvent): void {
    const list = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.set(Math.min(this.active() + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(Math.max(this.active() - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = list[this.active()]; if (f) this.open(f.path); }
    else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
  }

  open(path: string): void {
    this.router.navigateByUrl(urlForFile(path));
    this.close();
  }

  close(): void { this.state.paletteOpen.set(false); }
}
