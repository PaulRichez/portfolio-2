import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeComponent } from "../sections/me/me.component";
import { ExperiencesComponent } from "../sections/experiences/experiences.component";
import { SkillsComponent } from "../sections/skills/skills.component";
import { MeService } from '../../../services/me.service';
import { Me } from '../../../models';

@Component({
  selector: 'app-home',
  imports: [CommonModule, MeComponent, ExperiencesComponent, SkillsComponent],
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
