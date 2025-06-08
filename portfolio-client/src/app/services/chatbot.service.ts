import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

      fetch(streamUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'text/event-stream',
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('ReadableStream not supported');
        }

        let currentResponse = '';
        let sessionId = this.currentSessionId;

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              // Décoder les bytes en texte
              const chunk = new TextDecoder().decode(value);
              console.log('📥 Raw chunk received:', chunk);
              const lines = chunk.split('\n');

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
                      // Filtrer les balises <think> côté client aussi
                      const filteredContent = data.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                      console.log('🧹 Filtered content:', filteredContent);

                      if (filteredContent) {
                        // Ajouter le chunk à la réponse courante
                        currentResponse += filteredContent;
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
          } catch (streamError) {
            console.error('❌ Stream processing error:', streamError);
            observer.error(streamError);
            this.loadingSubject.next(false);
          }
        };

        processStream();
      })
      .catch(error => {
        console.error('❌ Fetch error:', error);
        observer.error(new Error('Erreur de connexion au streaming'));
        this.loadingSubject.next(false);
      });

      // Cleanup function
      return () => {
        this.loadingSubject.next(false);
      };
    });
  }

  /**
   * Met à jour le message de l'assistant pendant le streaming
   */
  private updateStreamingMessage(content: string): void {
    const currentMessages = this.messagesSubject.value;
    const lastMessage = currentMessages[currentMessages.length - 1];

    if (lastMessage && lastMessage.role === 'assistant') {
      // Mettre à jour le dernier message assistant
      lastMessage.content = content;
      this.messagesSubject.next([...currentMessages]);
    } else {
      // Créer un nouveau message assistant
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString()
      };
      this.messagesSubject.next([...currentMessages, assistantMessage]);
    }
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
