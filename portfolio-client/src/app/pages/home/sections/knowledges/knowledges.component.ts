import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChipModule } from 'primeng/chip';
import { Knowledge } from '../../../../models/knowledge.model';

@Component({
  selector: 'app-knowledges',
  standalone: true,
  imports: [CommonModule, ChipModule],
  templateUrl: './knowledges.component.html',
  styleUrls: ['./knowledges.component.css']
})
export class KnowledgesComponent {
  @Input() knowledges: Knowledge[] = [];
}
