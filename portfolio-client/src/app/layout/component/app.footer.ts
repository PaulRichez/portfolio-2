import { Component } from '@angular/core';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
        <span class="text-muted-color">© {{ year }} Paul Richez · Développeur Fullstack — Angular &amp; Strapi</span>
    </div>`
})
export class AppFooter {
    year = new Date().getFullYear();
}
