import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { ImageModule } from 'primeng/image';
import { RouterModule } from '@angular/router';
import { Project } from '../../../../models';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChipModule, ImageModule, RouterModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  @Input() projects: Project[] = [];

  ngOnInit() {
  }

  openUrl(url: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }
}
