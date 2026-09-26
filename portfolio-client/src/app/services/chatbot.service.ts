import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Événements SSE émis par `POST /api/chat/stream`
 * (portfolio-server/src/api/me/{controllers,services}/chat.ts).
 */
export type ChatStreamEvent =
  | { type: 'start'; sessionId: string }
  | { type: 'chunk'; content: string }
  | { type: 'tool_call'; id: string; name: string; args?: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string }
  | { type: 'open_file'; path: string }
  | { type: 'suggestions'; content: string[] }
  | { type: 'complete'; sessionId: string; response: string }
  | { type: 'error'; message: string };

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_KEY = 'chatbot-session-id';

/**
 * Client HTTP du chat : lit le flux SSE du serveur et le rend itérable.
 * L'affichage est entièrement délégué à aparté (voir chat-panel.component.ts).
 */
@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly api = `${environment.apiUrl}/chat`;
  private sessionId = restoreSessionId() ?? createSessionId();

  /** Démarre une nouvelle conversation côté serveur (nouvel identifiant de session). */
  newSession(): void {
    this.sessionId = createSessionId();
  }

  /** Historique de la session courante, tel que le serveur le garde en mémoire. */
  async history(): Promise<ChatHistoryMessage[]> {
    try {
      const res = await fetch(`${this.api}/history?sessionId=${encodeURIComponent(this.sessionId)}`);
      if (!res.ok) return [];
      const body = await res.json();
      return (body?.messages ?? []).filter(
        (m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content,
      );
    } catch {
      return [];
    }
  }

  /** Envoie un message et itère sur les événements du flux jusqu'à sa fermeture. */
  async *stream(message: string, signal: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    const res = await fetch(`${this.api}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message, sessionId: this.sessionId }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Le chat est indisponible (${res.status}).`);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let finished = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { finished = true; break; }
        buffer += value;
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (data && data !== '[DONE]') yield JSON.parse(data) as ChatStreamEvent;
        }
      }
    } finally {
      if (!finished) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}

function restoreSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function createSessionId(): string {
  const id = `session-${Date.now()}`;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch { /* navigation privée : la session vit le temps de l'onglet */ }
  return id;
}
