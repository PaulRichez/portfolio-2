import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { ImageModule } from 'primeng/image';
import { RouterModule } from '@angular/router';
import { Project } from '../../../../models';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChipModule, ImageModule, RouterModule, TooltipModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  @Input() projects: Project[] = [];

  private readonly MAX_VISIBLE_CODINGS = 3;

  ngOnInit() {
  }

  openUrl(url: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }

  getExtraCodings(codings: any[]): string {
    if (codings && codings.length > this.MAX_VISIBLE_CODINGS) {
      return codings.slice(this.MAX_VISIBLE_CODINGS).map(coding => coding.name).join(', ');
    }
    return '';
  }

  getMaxVisibleCodings(): number {
    return this.MAX_VISIBLE_CODINGS;
  }
}
