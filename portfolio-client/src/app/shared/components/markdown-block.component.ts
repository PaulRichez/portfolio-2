import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';

@Component({
  standalone: true,
  selector: 'app-markdown-block',
  imports: [CommonModule, MarkdownModule],
  template: `<markdown [data]="markdown"></markdown>`
})
export class MarkdownBlockComponent {
  @Input() markdown = '';

  constructor(private markdownService: MarkdownService) {
    // Override renderer to open links in new tab
    this.markdownService.renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${text}</a>`;
    };
  }
}
