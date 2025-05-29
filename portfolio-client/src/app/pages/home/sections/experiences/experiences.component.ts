import { Component, HostListener, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { Experience } from '../../../../models';

@Component({
  selector: 'app-experiences',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule],
  templateUrl: './experiences.component.html',
  styleUrl: './experiences.component.scss'
})
export class ExperiencesComponent implements OnInit {
  @Input() experiences: Experience[] = [];
  timelineAlign: 'left' | 'right' | 'alternate' = 'alternate';

  constructor() {}

  ngOnInit() {
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
