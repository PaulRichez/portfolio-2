import { Injectable, computed, signal } from '@angular/core';
import { SidebarPanel } from '../models';

const readNum = (key: string, def: number): number => {
  try { const v = parseInt(localStorage.getItem(key) || '', 10); return Number.isFinite(v) ? v : def; } catch { return def; }
};
const writeNum = (key: string, v: number): void => {
  try { localStorage.setItem(key, String(Math.round(v))); } catch { /* navigation privée */ }
};

/** État UI de l'IDE : onglets ouverts, panneau de sidebar, visibilité, largeurs. */
@Injectable({ providedIn: 'root' })
export class IdeStateService {

  readonly tabs = signal<string[]>([]);
  readonly activePath = signal<string | null>(null);

  readonly sidebarPanel = signal<SidebarPanel>('explorer');
  readonly sidebarVisible = signal(typeof window === 'undefined' || window.innerWidth > 768);

  /** Panneau de chat (secondary sidebar, à droite) façon Copilot. Ouvert par défaut (desktop). */
  readonly chatVisible = signal(typeof window === 'undefined' || window.innerWidth > 768);

  /** Command palette (Ctrl/Cmd+P) — ouverture rapide de fichier. */
  readonly paletteOpen = signal(false);

  /** Largeurs redimensionnables (persistées). */
  readonly sidebarWidth = signal(readNum('ide-sidebar-w', 260));
  readonly chatWidth = signal(readNum('ide-chat-w', 360));

  setSidebarWidth(w: number): void { this.sidebarWidth.set(w); writeNum('ide-sidebar-w', w); }
  setChatWidth(w: number): void { this.chatWidth.set(w); writeNum('ide-chat-w', w); }

  /** Raccourci (Ctrl+B) : bascule la visibilité de l'explorateur. */
  toggleSidebar(): void {
    const next = !this.sidebarVisible();
    this.sidebarVisible.set(next);
    if (next && typeof window !== 'undefined' && window.innerWidth <= 768) this.chatVisible.set(false);
  }

  readonly hasTabs = computed(() => this.tabs().length > 0);

  toggleChat(): void {
    const next = !this.chatVisible();
    this.chatVisible.set(next);
    // mobile : le chat plein écran et la sidebar gauche ne cohabitent pas
    if (next && typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.sidebarVisible.set(false);
    }
  }

  /** Ouvre (ou active) un onglet. Retourne true si le path était déjà ouvert. */
  open(path: string): void {
    if (!this.tabs().includes(path)) {
      this.tabs.update((t) => [...t, path]);
    }
    this.activePath.set(path);
    // mobile : ouvrir un fichier referme la sidebar (drawer)
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.sidebarVisible.set(false);
    }
  }

  /** Ferme un onglet ; retourne le path à activer ensuite (ou null si plus rien). */
  close(path: string): string | null {
    const tabs = this.tabs();
    const idx = tabs.indexOf(path);
    if (idx === -1) return this.activePath();
    const next = [...tabs.slice(0, idx), ...tabs.slice(idx + 1)];
    this.tabs.set(next);
    if (this.activePath() === path) {
      const fallback = next[idx - 1] ?? next[idx] ?? null;
      this.activePath.set(fallback);
      return fallback;
    }
    return this.activePath();
  }

  /** Clic sur une icône de l'activity bar : bascule ou change de panneau. */
  togglePanel(panel: SidebarPanel): void {
    if (this.sidebarPanel() === panel && this.sidebarVisible()) {
      this.sidebarVisible.set(false);
    } else {
      this.sidebarPanel.set(panel);
      this.sidebarVisible.set(true);
      // mobile : la sidebar (drawer) et le chat (plein écran) ne cohabitent pas
      if (typeof window !== 'undefined' && window.innerWidth <= 768) this.chatVisible.set(false);
    }
  }
}
