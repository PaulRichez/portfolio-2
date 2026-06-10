import { ChangeDetectionStrategy, Component, HostBinding, HostListener, input, output, signal } from '@angular/core';

/**
 * Poignée de redimensionnement (façon VS Code) entre deux panneaux.
 * `side` = de quel côté le panneau redimensionné se trouve :
 *   'right' → le panneau est à GAUCHE de la poignée (sidebar), tirer à droite l'agrandit.
 *   'left'  → le panneau est à DROITE de la poignée (chat), tirer à gauche l'agrandit.
 */
@Component({
  selector: 'ide-resize-handle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [`
    :host {
      width: 5px; flex: none; cursor: col-resize; align-self: stretch;
      background: transparent; z-index: 6; margin: 0 -2px;
    }
    :host(:hover), :host(.active) { background: var(--ide-accent); }
    @media (max-width: 768px) { :host { display: none; } }
  `],
})
export class ResizeHandleComponent {
  readonly width = input.required<number>();
  readonly min = input(180);
  readonly max = input(620);
  readonly side = input<'left' | 'right'>('right');
  readonly widthChange = output<number>();

  @HostBinding('class.active') protected dragging = false;

  @HostListener('mousedown', ['$event'])
  onDown(e: MouseEvent): void {
    e.preventDefault();
    this.dragging = true;
    const startX = e.clientX;
    const startW = this.width();
    const sign = this.side() === 'left' ? -1 : 1;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) * sign;
      const next = Math.max(this.min(), Math.min(this.max(), startW + delta));
      this.widthChange.emit(next);
    };
    const up = () => {
      this.dragging = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}
