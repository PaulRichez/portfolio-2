import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { VfsFile, VfsNode, urlForFile } from '../models';

/**
 * Système de fichiers virtuel du portfolio.
 * Charge l'arbre + le contenu de tous les fichiers en une requête (GET /vfs),
 * générés côté Strapi depuis les vraies données. Contenu léger (quelques Ko) →
 * un seul appel, accès synchrone ensuite.
 */
@Injectable({ providedIn: 'root' })
export class VfsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vfs`;

  readonly tree = signal<VfsNode[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  private readonly filesByPath = signal<Record<string, VfsFile>>({});
  private readonly pathSet = computed(() => new Set(Object.keys(this.filesByPath())));
  /** URL canonique → chemin de fichier (résolution inverse pour le routing). */
  private readonly urlMap = computed(() => {
    const map: Record<string, string> = {};
    for (const p of Object.keys(this.filesByPath())) map[urlForFile(p)] = p;
    return map;
  });

  load(): void {
    if (this.loaded()) return;
    this.http.get<{ tree: VfsNode[]; files: VfsFile[] }>(this.base).subscribe({
      next: (res) => {
        this.tree.set(res.tree ?? []);
        const map: Record<string, VfsFile> = {};
        for (const f of res.files ?? []) map[f.path] = f;
        this.filesByPath.set(map);
        this.loaded.set(true);
      },
      error: () => { this.failed.set(true); this.loaded.set(true); },
    });
  }

  exists(path: string): boolean { return this.pathSet().has(path); }

  getFile(path: string): VfsFile | null { return this.filesByPath()[path] ?? null; }

  /** Résout une URL (sans extension) vers le chemin de fichier, ou null. */
  pathForUrl(url: string): string | null {
    const clean = url.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
    return this.urlMap()[clean] ?? null;
  }
}
