import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { ExperiencesService } from '../../../../services/experiences.service';
import { Experience } from '../../../../models';

@Component({
  selector: 'app-experiences',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule],
  templateUrl: './experiences.component.html',
  styleUrl: './experiences.component.scss'
})
export class ExperiencesComponent implements OnInit {
  experiences: Experience[] = [];
  timelineAlign: 'left' | 'right' | 'alternate' = 'alternate';

  constructor(private experiencesService: ExperiencesService) {}

  ngOnInit() {
    this.experiencesService.getExperiences().subscribe(data => {
      this.experiences = data;
    });
    this.updateTimelineAlign();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.updateTimelineAlign();
  }

  private updateTimelineAlign() {
    if (window.innerWidth <= 768) {
      this.timelineAlign = 'left';
    } else {
      this.timelineAlign = 'alternate';
    }
  }
}
