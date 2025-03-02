import { Injectable, effect, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { Subject } from 'rxjs';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export interface layoutConfig {
  preset?: string;
  primary?: string;
  surface?: string | undefined | null;
  darkTheme?: boolean;
  menuMode?: string;
}

interface LayoutState {
  staticMenuDesktopInactive?: boolean;
  overlayMenuActive?: boolean;
  configSidebarVisible?: boolean;
  staticMenuMobileActive?: boolean;
  menuHoverActive?: boolean;
}

interface MenuChangeEvent {
  key: string;
  routeEvent?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  _config: layoutConfig = {
    preset: 'Aura',
    primary: 'emerald',
    surface: null,
    darkTheme: false,
    menuMode: 'static'
  };

  _state: LayoutState = {
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    configSidebarVisible: false,
    staticMenuMobileActive: false,
    menuHoverActive: false
  };

  layoutConfig = signal<layoutConfig>(this._config);

  layoutState = signal<LayoutState>(this._state);

  private configUpdate = new Subject<layoutConfig>();

  private overlayOpen = new Subject<any>();

  private menuSource = new Subject<MenuChangeEvent>();

  private resetSource = new Subject();

  menuSource$ = this.menuSource.asObservable();

  resetSource$ = this.resetSource.asObservable();

  configUpdate$ = this.configUpdate.asObservable();

  overlayOpen$ = this.overlayOpen.asObservable();

  theme = computed(() => (this.layoutConfig()?.darkTheme ? 'light' : 'dark'));

  isSidebarActive = computed(() => this.layoutState().overlayMenuActive || this.layoutState().staticMenuMobileActive);

  isDarkTheme = computed(() => this.layoutConfig().darkTheme);

  getPrimary = computed(() => this.layoutConfig().primary);

  getSurface = computed(() => this.layoutConfig().surface);

  isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

  transitionComplete = signal<boolean>(false);

  private initialized = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    @Inject(DOCUMENT) private document: Document,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const defaultTheme = this._getDefaultTheme();
      this.layoutConfig.set({ ...this.layoutConfig(), darkTheme: defaultTheme });
    }
    effect(() => {
      const config = this.layoutConfig();
      if (config) {
        this.onConfigUpdate();
      }
    });

    effect(() => {
      const config = this.layoutConfig();
      if (!this.initialized || !config) {
        this.initialized = true;
        return;
      }

      this.handleDarkModeTransition(config);
    });
  }

  private handleDarkModeTransition(config: layoutConfig): void {
    if ((this.document as any).startViewTransition) {
      this.startViewTransition(config);
    } else {
      this.toggleDarkMode(config);
      this.onTransitionEnd();
    }
  }

  private startViewTransition(config: layoutConfig): void {
    const transition = (document as any).startViewTransition(() => {
      this.toggleDarkMode(config);
    });

    transition.ready
      .then(() => {
        this.onTransitionEnd();
      })
      .catch(() => { });
  }

  toggleDarkMode(config?: layoutConfig): void {
    const _config = config || this.layoutConfig();
    this._saveThemeToStorage(!!_config.darkTheme);
    if (_config.darkTheme) {
      this.document.documentElement.classList.add('app-dark');
    } else {
      this.document.documentElement.classList.remove('app-dark');
    }
  }

  private onTransitionEnd() {
    this.transitionComplete.set(true);
    setTimeout(() => {
      this.transitionComplete.set(false);
    });
  }

  onMenuToggle() {
    if (this.isOverlay()) {
      this.layoutState.update((prev) => ({ ...prev, overlayMenuActive: !this.layoutState().overlayMenuActive }));

      if (this.layoutState().overlayMenuActive) {
        this.overlayOpen.next(null);
      }
    }

    if (this.isDesktop()) {
      this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive }));
    } else {
      this.layoutState.update((prev) => ({ ...prev, staticMenuMobileActive: !this.layoutState().staticMenuMobileActive }));

      if (this.layoutState().staticMenuMobileActive) {
        this.overlayOpen.next(null);
      }
    }
  }

  isDesktop() {
    return window.innerWidth > 991;
  }

  isMobile() {
    return !this.isDesktop();
  }

  onConfigUpdate() {
    this._config = { ...this.layoutConfig() };
    this.configUpdate.next(this.layoutConfig());
  }

  onMenuStateChange(event: MenuChangeEvent) {
    this.menuSource.next(event);
  }

  reset() {
    this.resetSource.next(true);
  }

  private _saveThemeToStorage(isDark: boolean) {
    this._setLocalStorage('theme', isDark ? 'dark' : 'light');
  }

  private _getDefaultTheme() {
    const localStorageTheme = this._getLocalStorage('theme');
    if (localStorageTheme) {
      return localStorageTheme == 'dark';
    } else {
      if (isPlatformBrowser(this.platformId)) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark;
      } else {
        return false;
      }
    }
  }

  private _getLocalStorage(key: string): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(key);
    }
    return null;
  }

  private _setLocalStorage(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, value);
    }
  }
}
