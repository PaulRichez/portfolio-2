import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { ExperiencesService } from '../../../../services/experiences.service';

interface Experience {
  id: number;
  startDate: string;
  endDate: string;
  job: string;
  business: string;
  businessWebsite: string;
  descriptions: string[];
}

@Component({
  selector: 'app-experiences',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule],
  templateUrl: './experiences.component.html',
  styleUrl: './experiences.component.scss'
})
export class ExperiencesComponent implements OnInit {
  experiences: Experience[] = [];

  constructor(private experiencesService: ExperiencesService) {}

  ngOnInit() {
    this.experiencesService.getExperiences().subscribe(data => {
      this.experiences = data;
    });
  }
}
