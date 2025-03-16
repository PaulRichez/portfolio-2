import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home/home.component';
import { AppLayout } from './layout/component/app.layout';

export const routes: Routes = [
  {
    path: '',
    component: AppLayout,
    children: [
        { path: '', component: HomeComponent },
    ]
},
];
