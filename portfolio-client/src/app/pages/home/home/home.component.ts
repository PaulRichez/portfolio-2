import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeComponent } from "../sections/me/me.component";
import { ExperiencesComponent } from "../sections/experiences/experiences.component";
import { EducationComponent } from "../sections/education/education.component";
import { ProjectsComponent } from "../sections/projects/projects.component";
import { MeService } from '../../../services/me.service';
import { Me } from '../../../models';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    MeComponent,
    ExperiencesComponent,
    EducationComponent,
    ProjectsComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  me: Me | null = null;
  loading: boolean = true;

  constructor(private meService: MeService) {}

  ngOnInit() {
    this.meService.getMeWithPopulate().subscribe({
      next: (data) => {
        this.me = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching me data:', error);
        this.loading = false;
      }
    });
  }
}
