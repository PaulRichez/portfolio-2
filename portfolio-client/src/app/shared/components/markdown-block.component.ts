import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  standalone: true,
  selector: 'app-markdown-block',
  imports: [CommonModule, MarkdownModule],
  template: `<markdown [data]="markdown"></markdown>`
})
export class MarkdownBlockComponent {
  @Input() markdown = '';
}
