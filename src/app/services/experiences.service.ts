import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface Experience {
  id: number;
  startDate: string;
  endDate: string;
  job: string;
  business: string;
  businessWebsite: string;
  descriptions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ExperiencesService {
  getExperiences(): Observable<Experience[]> {
    // Temporary mock data - replace with API call later
    return of([
      {
        id: 1,
        startDate: '2022-01',
        endDate: 'Present',
        job: 'Full Stack Developer',
        business: 'Tech Corp',
        businessWebsite: 'https://techcorp.com',
        descriptions: [
          'Developed responsive web applications using Angular and Node.js',
          'Implemented RESTful APIs for data integration'
        ]
      }
    ]);
  }
}