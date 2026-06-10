import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { VfsNode, urlForFile } from '../models';
import { fileIcon } from '../ide-icons';

interface Row {
  node: VfsNode;
  depth: number;
  icon: string;
  color: string;
}

@Component({
  selector: 'ide-explorer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="workspace" (click)="rootOpen.set(!rootOpen())">
      <i class="codicon" [class.codicon-chevron-down]="rootOpen()" [class.codicon-chevron-right]="!rootOpen()"></i>
      <span>PAUL-RICHEZ</span>
    </div>
    @if (rootOpen()) {
      @for (row of rows(); track row.node.path) {
        <div class="row"
             [class.active]="row.node.type === 'file' && state.activePath() === row.node.path"
             [style.padding-left.px]="8 + row.depth * 12"
             (click)="click(row.node)">
          @if (row.node.type === 'dir') {
            <i class="codicon chevron"
               [class.codicon-chevron-down]="expanded().has(row.node.path)"
               [class.codicon-chevron-right]="!expanded().has(row.node.path)"></i>
            <i class="codicon folder"
               [class.codicon-folder-opened]="expanded().has(row.node.path)"
               [class.codicon-folder]="!expanded().has(row.node.path)"></i>
          } @else {
            <i class="codicon file" [class]="'codicon ' + row.icon" [style.color]="row.color"></i>
          }
          <span class="name">{{ row.node.name }}</span>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; font-size: 13px; color: var(--ide-sidebar-fg); user-select: none; }
    .workspace {
      display: flex; align-items: center; gap: 2px; padding: 4px 8px;
      font-size: 11px; font-weight: 700; cursor: pointer; letter-spacing: .04em;
    }
    .row {
      display: flex; align-items: center; gap: 5px; height: 24px; cursor: pointer;
      white-space: nowrap; overflow: hidden;
    }
    .row:hover { background: var(--ide-hover); }
    .row.active { background: var(--ide-selection); }
    .codicon { font-size: 16px; flex: none; }
    .chevron { font-size: 16px; margin-left: -4px; }
    .folder { color: var(--ide-folder, #dcb67a); }
    .file { margin-left: 12px; }
    .name { overflow: hidden; text-overflow: ellipsis; }
  `],
})
export class ExplorerComponent {
  readonly state = inject(IdeStateService);
  private readonly vfs = inject(VfsService);
  private readonly router = inject(Router);

  readonly rootOpen = signal(true);
  readonly expanded = signal<Set<string>>(new Set(['cv', 'experience', 'projects']));

  readonly rows = computed<Row[]>(() => {
    const out: Row[] = [];
    const walk = (nodes: VfsNode[], depth: number) => {
      for (const node of nodes) {
        const { icon, color } = node.type === 'file' ? fileIcon(node.name) : { icon: '', color: '' };
        out.push({ node, depth, icon, color });
        if (node.type === 'dir' && this.expanded().has(node.path) && node.children) {
          walk(node.children, depth + 1);
        }
      }
    };
    walk(this.vfs.tree(), 0);
    return out;
  });

  click(node: VfsNode): void {
    if (node.type === 'dir') {
      this.expanded.update((set) => {
        const next = new Set(set);
        next.has(node.path) ? next.delete(node.path) : next.add(node.path);
        return next;
      });
    } else {
      this.router.navigateByUrl(urlForFile(node.path));
    }
  }
}
