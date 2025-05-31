import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Me, StrapiSingleResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getMe(): Observable<Me> {
    return this.http.get<StrapiSingleResponse<Me>>(`${this.apiUrl}/me`)
      .pipe(
        map(response => response.data)
      );
  }

  getMeWithPopulate(): Observable<Me> {
    return this.http.get<StrapiSingleResponse<Me>>(`${this.apiUrl}/me/populated`)
      .pipe(
        map(response => response.data)
      );
  }
}
