import { Component, Input } from '@angular/core';
import { Me } from '../../../../models';

@Component({
  selector: 'app-me',
  imports: [],
  templateUrl: './me.component.html',
  styleUrl: './me.component.scss'
})
export class MeComponent {
  @Input() me: Me | null = null;
}
