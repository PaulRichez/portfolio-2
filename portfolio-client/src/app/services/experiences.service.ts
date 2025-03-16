import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  constructor(private http: HttpClient) {}

  getExperiences(): Observable<Experience[]> {
    return this.http.get<Experience[]>('/api/experiences');
  }
}