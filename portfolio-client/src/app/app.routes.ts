import { Routes } from '@angular/router';
import { IdeShellComponent } from './ide/ide-shell.component';

export const routes: Routes = [
  // chaque URL est un chemin de fichier du portfolio, ex. /projects/packages/devkit-for-strapi.md
  { path: '**', component: IdeShellComponent },
];
