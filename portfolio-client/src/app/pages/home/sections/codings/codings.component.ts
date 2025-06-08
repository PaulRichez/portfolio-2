import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodingSkill } from '../../../../models';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';

interface CategorizedCoding {
  category: string;
  items: CodingSkill[];
}

@Component({
  selector: 'app-codings',
  standalone: true,
  imports: [CommonModule, CardModule, ChipModule],
  templateUrl: './codings.component.html',
  styleUrls: ['./codings.component.scss']
})
export class CodingsComponent implements OnInit, OnChanges {
  @Input() coding_skills: CodingSkill[] = [];

  categorizedCodings: CategorizedCoding[] = [];

  ngOnInit() {
    this.categorizeCodingSkills();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['coding_skills']) {
      this.categorizeCodingSkills();
    }
  }

  private categorizeCodingSkills() {
    if (!this.coding_skills || this.coding_skills.length === 0) {
      this.categorizedCodings = [];
      return;
    }

    const categories = new Map<string, CodingSkill[]>();

    this.coding_skills.forEach(codingSkill => {
      const category = codingSkill.coding.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(codingSkill);
    });

    this.categorizedCodings = Array.from(categories.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => this.getCategoryOrder(a.category) - this.getCategoryOrder(b.category));
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
      'other_languages': 'pi pi-file'
    };
    return icons[category] || 'pi pi-code';
  }

  getLevelValue(level: string): number {
    switch (level.toLowerCase()) {
      case 'beginner': return 1;
      case 'intermediate': return 2;
      case 'advanced': return 3;
      case 'expert': return 4;
      default: return 0;
    }
  }

  getLevelLabel(level: string): string {
    switch (level.toLowerCase()) {
      case 'beginner': return 'Débutant';
      case 'intermediate': return 'Intermédiaire';
      case 'advanced': return 'Avancé';
      case 'expert': return 'Expert';
      default: return level;
    }
  }

  getLanguageLevelLabel(percentage: number): string {
    if (percentage >= 95) return 'Langue maternelle';
    if (percentage >= 85) return 'Courant';
    if (percentage >= 70) return 'Avancé';
    if (percentage >= 50) return 'Intermédiaire';
    if (percentage >= 30) return 'Débutant';
    return 'Notions';
  }

  getLevelDots(level: string): number[] {
    return Array(4).fill(0).map((_, i) => i);
  }

  private getCategoryOrder(category: string): number {
    const order: { [key: string]: number } = {
      'frontend_languages': 1,
      'frontend_frameworks': 2,
      'backend': 3,
      'databases': 4,
      'devops_tools': 5,
      'tools': 6,
      'other_languages': 7
    };
    return order[category] || 99;
  }
}
