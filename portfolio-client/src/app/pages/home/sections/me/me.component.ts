import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
import { Me } from '../../../../models';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-me',
  imports: [CommonModule, CardModule, AvatarModule, ButtonModule, ChipModule, DividerModule],
  templateUrl: './me.component.html',
  styleUrl: './me.component.scss'
})
export class MeComponent {
  @Input() me: Me | null = null;

  getInitials(): string {
    if (!this.me?.firstName || !this.me?.lastName) {
      return 'NA';
    }
    return this.me.firstName.charAt(0) + this.me.lastName.charAt(0);
  }

  getCvDownloadUrl(): string {
    return `${environment.apiUrl}/me/cv`;
  }
}
