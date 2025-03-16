import { Component } from '@angular/core';
import { MeComponent } from "../sections/me/me.component";
import { ExperiencesComponent } from "../sections/experiences/experiences.component";
import { SkillsComponent } from "../sections/skills/skills.component";

@Component({
  selector: 'app-home',
  imports: [MeComponent, ExperiencesComponent, SkillsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

}
