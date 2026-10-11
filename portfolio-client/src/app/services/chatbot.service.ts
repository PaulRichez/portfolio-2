import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Relances du chat : 3 questions courtes proposées après une réponse.
 * Le chat lui-même passe par aparté (`POST /api/chat/agent`, voir chat-panel.component.ts).
 */
@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly api = `${environment.apiUrl}/chat`;

  async suggestions(question: string, answer: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.api}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });
      if (!res.ok) return [];
      const body = await res.json();
      return Array.isArray(body?.suggestions) ? body.suggestions.filter((s: unknown) => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }
}
