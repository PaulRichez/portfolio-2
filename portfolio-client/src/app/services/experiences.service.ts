import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Experience, Me, StrapiSingleResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ExperiencesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getExperiences(): Observable<Experience[]> {
    return this.http.get<StrapiSingleResponse<Me>>(`${this.apiUrl}/me?populate=experiences`)
      .pipe(
        map(response => response.data.experiences || [])
      );
  }
}
