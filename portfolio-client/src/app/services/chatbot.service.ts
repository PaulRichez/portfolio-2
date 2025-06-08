import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  sessionId: string;
  title?: string;
  messageCount: number;
  lastActivity: string;
  lastMessage: string;
}

export interface ChatResponse {
  sessionId: string;
  response: string;
  history: ChatMessage[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly API_URL = environment.apiUrl + '/llm-chat';
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private currentSessionId = `session-${Date.now()}`;

  public messages$ = this.messagesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}  /**
   * Envoie un message au chatbot avec streaming
   */
  sendMessage(message: string): Observable<ChatResponse> {
    this.loadingSubject.next(true);

    return new Observable<ChatResponse>(observer => {
      // Ajouter le message utilisateur immédiatement
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      this.addMessage(userMessage);

      const formData = new FormData();
      formData.append('message', message);
      formData.append('sessionId', this.currentSessionId);

      const streamUrl = `${this.API_URL}/stream`;
      console.log('🌐 Streaming URL:', streamUrl);

      const headers = new HttpHeaders({
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });

      // Utiliser HttpClient avec streaming
      const request = this.http.post(streamUrl, formData, {
        headers: headers,
        observe: 'events',
        responseType: 'text',
        reportProgress: true
      });

      let currentResponse = '';
      let sessionId = this.currentSessionId;
      let buffer = '';

      const subscription = request.subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.DownloadProgress) {
            const chunk = event.partialText || '';

            // Ajouter le nouveau chunk au buffer
            if (chunk.length > buffer.length) {
              const newData = chunk.slice(buffer.length);
              buffer = chunk;

              console.log('📥 New chunk received:', newData);

              // Traiter les lignes complètes
              const lines = newData.split('\n');

              for (const line of lines) {
                console.log('📋 Processing line:', line);
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    console.log('📊 Parsed data:', data);

                    if (data.type === 'start') {
                      sessionId = data.sessionId || sessionId;
                      console.log('🌊 Streaming started for session:', sessionId);
                    } else if (data.type === 'chunk') {
                      console.log('🧩 Chunk content received:', data.content);

                      if (data.content) {
                        // Ajouter le chunk à la réponse courante
                        currentResponse += data.content;
                        console.log('📝 Current response:', currentResponse);

                        // Mettre à jour le message assistant en temps réel
                        this.updateStreamingMessage(currentResponse);
                      }

                    } else if (data.type === 'complete') {
                      // Streaming terminé
                      console.log('✅ Streaming completed');

                      observer.next({
                        sessionId: sessionId,
                        response: currentResponse,
                        history: []
                      });

                      observer.complete();
                      this.loadingSubject.next(false);
                      return;

                    } else if (data.type === 'error') {
                      console.error('❌ Streaming error:', data.message);
                      observer.error(new Error(data.message || 'Erreur de streaming'));
                      this.loadingSubject.next(false);
                      return;
                    }
                  } catch (parseError) {
                    console.error('❌ Error parsing SSE data:', parseError, 'Line:', line);
                  }
                }
              }
            }
          }
        },
        error: (error) => {
          console.error('❌ HTTP error:', error);
          observer.error(new Error('Erreur de connexion au streaming'));
          this.loadingSubject.next(false);
        },
        complete: () => {
          // S'assurer que la réponse finale est envoyée si pas déjà fait
          if (currentResponse && !observer.closed) {
            observer.next({
              sessionId: sessionId,
              response: currentResponse,
              history: []
            });
            observer.complete();
          }
          this.loadingSubject.next(false);
        }
      });

      // Cleanup function
      return () => {
        subscription.unsubscribe();
        this.loadingSubject.next(false);
      };
    });
  }

  /**
   * Met à jour le message de l'assistant pendant le streaming
   */
  private updateStreamingMessage(content: string): void {
    const currentMessages = [...this.messagesSubject.value]; // Créer une nouvelle référence
    const lastMessage = currentMessages[currentMessages.length - 1];

    if (lastMessage && lastMessage.role === 'assistant') {
      // Créer un nouveau message pour forcer la détection de changement
      const updatedMessage: ChatMessage = {
        ...lastMessage,
        content: content,
        timestamp: new Date().toISOString()
      };
      currentMessages[currentMessages.length - 1] = updatedMessage;
    } else {
      // Créer un nouveau message assistant
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString()
      };
      currentMessages.push(assistantMessage);
    }

    // Émettre le nouveau tableau pour déclencher la détection de changement
    this.messagesSubject.next(currentMessages);
  }

  /**
   * Récupère l'historique de la session actuelle
   */
  getHistory(): Observable<{ messages: ChatMessage[], messageCount: number, session: any }> {
    return this.http.get<{ messages: ChatMessage[], messageCount: number, session: any }>(
      `${this.API_URL}/history?sessionId=${this.currentSessionId}`
    );
  }

  /**
   * Récupère toutes les sessions
   */
  getAllSessions(): Observable<{ sessions: ChatSession[] }> {
    return this.http.get<{ sessions: ChatSession[] }>(`${this.API_URL}/sessions`);
  }

  /**
   * Efface l'historique de la session actuelle
   */
  clearHistory(): Observable<{ success: boolean, sessionId: string }> {
    return this.http.delete<{ success: boolean, sessionId: string }>(
      `${this.API_URL}/history?sessionId=${this.currentSessionId}`
    );
  }

  /**
   * Supprime une session
   */
  deleteSession(sessionId: string): Observable<{ success: boolean, sessionId: string }> {
    return this.http.delete<{ success: boolean, sessionId: string }>(
      `${this.API_URL}/sessions/${sessionId}`
    );
  }

  /**
   * Met à jour le titre d'une session
   */
  updateSessionTitle(sessionId: string, title: string): Observable<{ success: boolean, sessionId: string, title: string }> {
    return this.http.put<{ success: boolean, sessionId: string, title: string }>(
      `${this.API_URL}/sessions/${sessionId}/title`,
      { title }
    );
  }

  /**
   * Streaming des messages (pour une future implémentation)
   */
  streamMessage(message: string): Observable<any> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('sessionId', this.currentSessionId);

    return this.http.post(`${this.API_URL}/stream`, formData);
  }

  /**
   * Met à jour les messages localement
   */
  updateMessages(messages: ChatMessage[]): void {
    this.messagesSubject.next(messages);
  }

  /**
   * Ajoute un message localement
   */
  addMessage(message: ChatMessage): void {
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  /**
   * Définit l'état de chargement
   */
  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  /**
   * Obtient l'ID de session actuel
   */
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Change la session actuelle
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.messagesSubject.next([]); // Reset messages pour la nouvelle session
  }

  /**
   * Crée une nouvelle session
   */
  createNewSession(): void {
    this.currentSessionId = `session-${Date.now()}`;
    this.messagesSubject.next([]);
  }
}
