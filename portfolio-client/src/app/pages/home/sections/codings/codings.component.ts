import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { Coding } from '../../../../models';

interface CategorizedCodings {
  category: string;
  items: Coding[];
}

@Component({
  selector: 'app-codings',
  standalone: true,
  imports: [CommonModule, CardModule, ChipModule],
  templateUrl: './codings.component.html',
  styleUrl: './codings.component.scss'
})
export class CodingsComponent implements OnInit {
  @Input() codings: Coding[] = [];
  categorizedCodings: CategorizedCodings[] = [];

  ngOnInit() {
    this.groupCodingsByCategory();
  }

  ngOnChanges() {
    this.groupCodingsByCategory();
  }

  private groupCodingsByCategory() {
    const categories = [...new Set(this.codings.map(coding => coding.category))];
    this.categorizedCodings = categories.map(category => ({
      category,
      items: this.codings.filter(coding => coding.category === category)
    }));
  }

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'frontend_languages': 'Langages Frontend',
      'frontend_frameworks': 'Frameworks Frontend',
      'backend': 'Backend',
      'databases': 'Bases de données',
      'devops_tools': 'Outils DevOps',
      'tools': 'Outils',
      'other_languages': 'Autres langages'
    };
    return labels[category] || category;
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'frontend_languages': 'pi pi-code',
      'frontend_frameworks': 'pi pi-desktop',
      'backend': 'pi pi-server',
      'databases': 'pi pi-database',
      'devops_tools': 'pi pi-cog',
      'tools': 'pi pi-wrench',
      'other_languages': 'pi pi-file-code'
    };
    return icons[category] || 'pi pi-code';
  }

  getLevelValue(level: string): number {
    const levels: { [key: string]: number } = {
      'beginner': 1,
      'Intermediate': 2,
      'advanced': 3,
      'expert': 4
    };
    return levels[level] || 1;
  }

  getLevelLabel(level: string): string {
    const labels: { [key: string]: string } = {
      'beginner': 'Débutant',
      'Intermediate': 'Intermédiaire',
      'advanced': 'Avancé',
      'expert': 'Expert'
    };
    return labels[level] || level;
  }

  getLevelDots(level: string): number[] {
    return Array(4).fill(0).map((_, i) => i);
  }
}
