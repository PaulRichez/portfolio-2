import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        <ng-container *ngFor="let item of model; let i = index">
            <li app-menuitem *ngIf="!item.separator" [item]="item" [index]="i" [root]="true"></li>
            <li *ngIf="item.separator" class="menu-separator"></li>
        </ng-container>
    </ul> `
})
export class AppMenu {
    model: MenuItem[] = [];

    ngOnInit() {
        this.model = [
            {
                label: 'Portfolio',
                items: [
                    { label: 'Accueil', icon: 'pi pi-fw pi-home', command: () => this.scrollTo('top') },
                    { label: 'Projets', icon: 'pi pi-fw pi-folder', command: () => this.scrollTo('projects') },
                    { label: 'Expériences', icon: 'pi pi-fw pi-briefcase', command: () => this.scrollTo('experience') },
                    { label: 'Formation', icon: 'pi pi-fw pi-book', command: () => this.scrollTo('education') },
                    { label: 'Compétences', icon: 'pi pi-fw pi-code', command: () => this.scrollTo('skills') }
                ]
            },
            {
                label: 'Liens',
                items: [
                    {
                        label: 'GitHub',
                        icon: 'pi pi-fw pi-github',
                        url: 'https://github.com/PaulRichez',
                        target: '_blank'
                    },
                    {
                        label: 'LinkedIn',
                        icon: 'pi pi-fw pi-linkedin',
                        url: 'https://www.linkedin.com/in/paul-richez/',
                        target: '_blank'
                    }
                ]
            }
        ];
    }

    /** Smoothly scroll to a section anchor on the home page. */
    private scrollTo(id: string): void {
        if (typeof document === 'undefined') {
            return;
        }
        if (id === 'top') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
