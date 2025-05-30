import { Component, Input } from '@angular/core';
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
export class EducationComponent {
  @Input() diplomas: Diploma[] = [];
}
