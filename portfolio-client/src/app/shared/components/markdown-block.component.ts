import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';

@Component({
  standalone: true,
  selector: 'app-markdown-block',
  imports: [CommonModule, MarkdownModule],
  template: `<markdown [data]="markdown"></markdown>`,
  host: { '(click)': 'onClick($event)' },
})
export class MarkdownBlockComponent {
  @Input() markdown = '';
  private readonly router = inject(Router);

  constructor(private markdownService: MarkdownService) {
    // Liens internes (commençant par /) → même onglet (nav SPA) ; externes → nouvel onglet.
    this.markdownService.renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      const attrs = href && href.startsWith('/') ? '' : ' target="_blank" rel="noopener noreferrer"';
      return `<a href="${href}"${attrs} title="${title || ''}">${text}</a>`;
    };
  }

  // Intercepte les liens internes pour router sans recharger la page.
  onClick(e: MouseEvent): void {
    const anchor = (e.target as HTMLElement)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (anchor && href && href.startsWith('/')) {
      e.preventDefault();
      this.router.navigateByUrl(href);
    }
  }
}
