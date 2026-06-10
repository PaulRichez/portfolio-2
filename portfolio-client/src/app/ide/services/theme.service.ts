import { Injectable, computed, effect, signal } from '@angular/core';
import { ThemeMode } from '../models';

const STORAGE_KEY = 'ide-theme';

/**
 * Thème de l'IDE : system (défaut) | dark | light.
 * Applique la classe `.app-dark` sur <html> — c'est aussi le darkModeSelector
 * de PrimeNG, donc le chat suit automatiquement.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  private readonly systemDark = signal(this.media?.matches ?? true);

  readonly mode = signal<ThemeMode>(this.restore());

  readonly isDark = computed(() =>
    this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.isDark());
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* navigation privée */ }
  }

  private restore(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    } catch { /* navigation privée */ }
    return 'system';
  }
}
