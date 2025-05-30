import { Component, Input, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { Diploma } from '../../../../models';

@Component({
  selector: 'app-education',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule, ChipModule],
  templateUrl: './education.component.html',
  styleUrl: './education.component.scss'
})
export class EducationComponent implements OnInit {
  @Input() diplomas: Diploma[] = [];
  timelineAlign: 'left' | 'right' | 'alternate' = 'alternate';

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
