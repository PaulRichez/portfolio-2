import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { ImageModule } from 'primeng/image';

interface Project {
  id: string;
  title: string;
  description: string;
  image?: string;
  technologies: string[];
  demoUrl?: string;
  sourceUrl?: string;
  featured?: boolean;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChipModule, ImageModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  @Input() projects: Project[] = [];

  // Données d'exemple - à remplacer par les vraies données
  mockProjects: Project[] = [
    {
      id: '1',
      title: 'Portfolio Personnel',
      description: 'Site portfolio moderne développé avec Angular et PrimeNG, intégrant un thème sombre/clair et une interface responsive.',
      image: 'assets/images/project1.jpg',
      technologies: ['Angular', 'TypeScript', 'PrimeNG', 'Tailwind CSS'],
      demoUrl: 'https://example.com',
      sourceUrl: 'https://github.com/example',
      featured: true
    },
    {
      id: '2',
      title: 'Application E-commerce',
      description: 'Plateforme e-commerce complète avec gestion des produits, panier d\'achats et système de paiement intégré.',
      image: 'assets/images/project2.jpg',
      technologies: ['React', 'Node.js', 'MongoDB', 'Stripe'],
      demoUrl: 'https://example.com',
      sourceUrl: 'https://github.com/example',
      featured: true
    },
    {
      id: '3',
      title: 'Dashboard Analytics',
      description: 'Tableau de bord analytique avec visualisations de données en temps réel et rapports personnalisables.',
      image: 'assets/images/project3.jpg',
      technologies: ['Vue.js', 'Chart.js', 'Express', 'PostgreSQL'],
      demoUrl: 'https://example.com',
      sourceUrl: 'https://github.com/example',
      featured: false
    }
  ];

  ngOnInit() {
    if (!this.projects || this.projects.length === 0) {
      this.projects = this.mockProjects;
    }
  }

  openUrl(url: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }
}
