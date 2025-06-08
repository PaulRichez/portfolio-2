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
  private readonly SESSION_STORAGE_KEY = 'chatbot-session-id';
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private currentSessionId: string | null = null;

  public messages$ = this.messagesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    // Initialiser avec une session existante ou en créer une nouvelle
    this.initializeSession();
  }

  /**
   * Initialise la session au démarrage
   */
  private initializeSession(): void {
    const savedSessionId = this.loadSessionIdFromStorage();

    if (savedSessionId) {
      console.log('🔄 Restauration de la session:', savedSessionId);
      this.currentSessionId = savedSessionId;
      this.restoreConversationHistory();
    } else {
      console.log('🆕 Création d\'une nouvelle session');
      this.createNewSession();
    }
  }

  /**
   * Sauvegarde le sessionId dans localStorage
   */
  private saveSessionIdToStorage(sessionId: string): void {
    try {
      localStorage.setItem(this.SESSION_STORAGE_KEY, sessionId);
      console.log('💾 SessionId sauvegardé:', sessionId);
    } catch (error) {
      console.warn('⚠️ Impossible de sauvegarder le sessionId:', error);
    }
  }

  /**
   * Charge le sessionId depuis localStorage
   */
  private loadSessionIdFromStorage(): string | null {
    try {
      const sessionId = localStorage.getItem(this.SESSION_STORAGE_KEY);
      console.log('📂 SessionId chargé:', sessionId);
      return sessionId;
    } catch (error) {
      console.warn('⚠️ Impossible de charger le sessionId:', error);
      return null;
    }
  }

  /**
   * Supprime le sessionId du localStorage
   */
  private removeSessionIdFromStorage(): void {
    try {
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
      console.log('🗑️ SessionId supprimé du localStorage');
    } catch (error) {
      console.warn('⚠️ Impossible de supprimer le sessionId:', error);
    }
  }

  /**
   * Restaure l'historique de conversation pour la session actuelle
   */
  private restoreConversationHistory(): void {
    this.getHistory().subscribe({
      next: (historyData) => {
        if (historyData.messages && historyData.messages.length > 0) {
          console.log('🔄 Historique restauré:', historyData.messages.length, 'messages');

          // Convertir les messages de la base de données au format ChatMessage
          const messages: ChatMessage[] = historyData.messages.map((msg: any) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: msg.timestamp || msg.createdAt
          }));

          this.messagesSubject.next(messages);
        } else {
          console.log('ℹ️ Aucun historique trouvé pour la session');
        }
      },
      error: (error) => {
        console.error('❌ Erreur lors de la restauration de l\'historique:', error);
        // En cas d'erreur, créer une nouvelle session
        this.createNewSession();
      }
    });
  }

  /**
   * Envoie un message au chatbot avec streaming
   */
  sendMessage(message: string): Observable<ChatResponse> {
    this.loadingSubject.next(true);

    return new Observable<ChatResponse>(observer => {
      // S'assurer qu'on a un sessionId valide
      if (!this.currentSessionId) {
        this.createNewSession();
      }

      // Ajouter le message utilisateur immédiatement
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      this.addMessage(userMessage);

      const formData = new FormData();
      formData.append('message', message);
      formData.append('sessionId', this.currentSessionId!); // Non-null assertion car on vient de vérifier

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
      let sessionId = this.currentSessionId!; // Non-null assertion car on a vérifié
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
                        sessionId: sessionId as string, // Assurer le type string
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
              sessionId: sessionId as string, // Assurer le type string
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
    // S'assurer qu'on a un sessionId valide
    if (!this.currentSessionId) {
      this.createNewSession();
    }

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
    // S'assurer qu'on a un sessionId valide
    if (!this.currentSessionId) {
      this.createNewSession();
    }

    const formData = new FormData();
    formData.append('message', message);
    formData.append('sessionId', this.currentSessionId!);

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
    if (!this.currentSessionId) {
      this.createNewSession();
    }
    return this.currentSessionId!;
  }

  /**
   * Change la session actuelle
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.saveSessionIdToStorage(sessionId);
    this.messagesSubject.next([]); // Reset messages pour la nouvelle session

    // Restaurer l'historique de la nouvelle session
    this.restoreConversationHistory();
  }

  /**
   * Crée une nouvelle session
   */
  createNewSession(): void {
    this.currentSessionId = `session-${Date.now()}`;
    this.saveSessionIdToStorage(this.currentSessionId);
    this.messagesSubject.next([]);
    console.log('🆕 Nouvelle session créée:', this.currentSessionId);
  }

  /**
   * Efface l'historique de la session actuelle et la supprime du localStorage
   */
  clearHistory(): Observable<{ success: boolean, sessionId: string }> {
    return new Observable(observer => {
      // S'assurer qu'on a un sessionId valide
      if (!this.currentSessionId) {
        this.createNewSession();
      }

      const request = this.http.delete<{ success: boolean, sessionId: string }>(
        `${this.API_URL}/history?sessionId=${this.currentSessionId}`
      );

      request.subscribe({
        next: (response) => {
          console.log('✅ Historique effacé côté serveur:', response);

          // Supprimer du localStorage et créer une nouvelle session
          this.removeSessionIdFromStorage();
          this.createNewSession();

          // Reset les messages localement
          this.messagesSubject.next([]);

          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          console.error('❌ Erreur lors de l\'effacement de l\'historique:', error);
          observer.error(error);
        }
      });
    });
  }
}
