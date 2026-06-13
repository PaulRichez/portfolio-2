/** Modèles du shell IDE (explorer, onglets, thème). */

export type FileLanguage = 'markdown' | 'typescript' | 'json' | 'dotenv' | 'pdf' | 'demo' | 'text';

export interface VfsNode {
  name: string;
  path: string;            // chemin complet, ex. "projects/aimi.md"
  type: 'dir' | 'file';
  children?: VfsNode[];
}

export interface VfsFile {
  path: string;
  language: FileLanguage;
  content: string;         // vide pour les pdf (rendus via iframe)
}

export type ThemeMode = 'system' | 'dark' | 'light';

/** Fichier ouvert par défaut (la racine `/` y redirige). */
export const ROOT_FILE = 'README.md';

/**
 * URL canonique d'un fichier — SANS extension ni point initial.
 * Indispensable : une URL contenant un point (`.md`) est traitée comme un
 * fichier statique par Vite (dev) et nginx/hôtes (prod) → 404 au refresh.
 *   README.md          → /README
 *   projects/aimi.md   → /projects/aimi
 *   cv/cv.pdf          → /cv/cv
 *   .env               → /env
 */
export function urlForFile(path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
  let base = path.slice(slash + 1);
  base = base.startsWith('.')
    ? base.slice(1).replace(/\.[^.]*$/, '')   // .env → env
    : base.replace(/\.[^.]+$/, '');           // README.md → README
  return '/' + dir + base;
}

export type SidebarPanel = 'explorer' | 'theme';
