import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ToolInvocation {
  id: string;
  name: string;
  args: any;
  status: 'running' | 'done' | 'error';
  result?: string; // contenu lu/retourné par l'outil (chip dépliable)
}

export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'tool'; tool: ToolInvocation };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isStreaming?: boolean; // message en cours de streaming
  isError?: boolean;
  /** Pour un message assistant : suite ordonnée de blocs (texte + outils inline). */
  parts?: MessagePart[];
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
  provider?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly API_URL = environment.apiUrl + '/chat';
  private readonly SESSION_STORAGE_KEY = 'chatbot-session-id';
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private statusSubject = new BehaviorSubject<string>('');
  private suggestionsSubject = new BehaviorSubject<string[]>([]);
  private currentSessionId: string | null = null;

  private openFileSubject = new Subject<string>();

  public messages$ = this.messagesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public status$ = this.statusSubject.asObservable();
  public suggestions$ = this.suggestionsSubject.asObservable();
  /** Émis quand l'IA demande d'ouvrir un fichier (tool open_file). */
  public openFile$ = this.openFileSubject.asObservable();

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

  // ... (rest of methods) ...

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
    this.suggestionsSubject.next([]); // vider les anciennes suggestions le temps de la réponse

    return new Observable<ChatResponse>(observer => {
      if (!this.currentSessionId) {
        this.createNewSession();
      }

      // Initialiser le message assistant vide UI
      // Pour avoir un feedback immédiat
      const initialAssistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true
      };
      // On l'ajoute plus tard au premier événement, ou tout de suite ?
      // Attendons le 'start' du serveur pour être sûr de la session

      const payload = {
        message,
        sessionId: this.currentSessionId!
      };

      const streamUrl = `${this.API_URL}/stream`;
      console.log('🌐 Streaming URL:', streamUrl);

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });

      const request = this.http.post(streamUrl, payload, {
        headers,
        observe: 'events',
        responseType: 'text',
        reportProgress: true,
        withCredentials: true,
      });

      let currentResponse = '';
      let sessionId = this.currentSessionId!;
      let processedLength = 0; // Track processed characters
      let hasStarted = false;

      const subscription = request.subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.DownloadProgress) {
            const allText = event.partialText || '';
            const newText = allText.slice(processedLength);

            // Si pas de nouvelle données ou pas de saut de ligne (donc pas de message complet potentiel), on attend
            if (newText.length === 0 || !newText.includes('\n')) {
              return;
            }

            // Gérer les lignes incomplètes
            const lines = newText.split('\n');
            let safeToProcessLength = newText.length;

            // Si le texte ne finit pas par \n, la dernière ligne est incomplète
            if (!newText.endsWith('\n')) {
              const incompleteLine = lines.pop(); // On la retire pour le moment
              if (incompleteLine) {
                safeToProcessLength -= incompleteLine.length;
              }
            }

            // Mise à jour de la longueur traitée pour le prochain tour
            processedLength += safeToProcessLength;

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                try {
                  const jsonStr = line.trim().slice(6);
                  // Ignorer les messages simples [DONE] s'ils arrivent format texte
                  if (jsonStr === '[DONE]') continue;

                  const data = JSON.parse(jsonStr);

                  if (data.type === 'start') {
                    sessionId = data.sessionId || sessionId;
                    if (!hasStarted) {
                      this.addMessage({ role: 'user', content: message, timestamp: new Date().toISOString() });
                      // coquille assistant : préambule, outils et réponse s'y agrègent en parts
                      this.addMessage({ role: 'assistant', content: '', parts: [], timestamp: new Date().toISOString(), isStreaming: true });
                      hasStarted = true;
                    }

                  } else if (data.type === 'chunk') {
                    if (data.content) { currentResponse += data.content; this.appendAssistantText(data.content); }

                  } else if (data.type === 'status') {
                    this.statusSubject.next(data.message);

                  } else if (data.type === 'suggestions') {
                    if (data.content && Array.isArray(data.content)) this.suggestionsSubject.next(data.content);

                  } else if (data.type === 'tool_call') {
                    this.addAssistantTool({ id: data.id, name: data.name, args: data.args || {}, status: 'running' });

                  } else if (data.type === 'tool_result') {
                    this.updateAssistantTool(data.id, data.ok === false ? 'error' : 'done', data.result);

                  } else if (data.type === 'open_file') {
                    if (data.path) this.openFileSubject.next(data.path);

                  } else if (data.type === 'complete') {
                    // Update final with history if provided, or just current response
                    this.finalizeStreamingMessage();

                    observer.next({
                      sessionId: sessionId,
                      response: data.response || currentResponse,
                      history: [] // On pourrait recharger l'historique ici
                    });
                    observer.complete();
                    this.loadingSubject.next(false);
                    return;

                  } else if (data.type === 'error') {
                    console.error('❌ Stream Error:', data.message);
                    observer.error(new Error(data.message || 'Erreur de streaming'));
                    this.loadingSubject.next(false);
                    return;
                  }
                } catch (parseError) {
                  console.warn('⚠️ Erreur parsing ligne:', line, parseError);
                }
              }
            }
          }
        },
        error: (error) => {
          console.error('❌ HTTP error:', error);
          this.finalizeStreamingMessage(); // Stop blinking cursor
          observer.error(new Error('Erreur de connexion au streaming'));
          this.loadingSubject.next(false);
        },
        complete: () => {
          this.finalizeStreamingMessage();

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

      return () => {
        subscription.unsubscribe();
        this.loadingSubject.next(false);
        this.finalizeStreamingMessage();
      };
    });
  }

  /**
   * Met à jour un message en streaming
   */
  /** Ajoute du texte à la coquille assistant (dernier message) : nouveau bloc texte ou suite du dernier. */
  private appendAssistantText(delta: string): void {
    const messages = this.messagesSubject.value;
    const a = messages[messages.length - 1];
    if (!a || a.role !== 'assistant' || !a.parts) return;
    const last = a.parts[a.parts.length - 1];
    if (last && last.type === 'text') last.content += delta;
    else a.parts.push({ type: 'text', content: delta });
    a.content += delta;
    this.messagesSubject.next([...messages]);
  }

  /** Ajoute un bloc outil (chip) inline dans la réponse assistant en cours. */
  private addAssistantTool(tool: ToolInvocation): void {
    const messages = this.messagesSubject.value;
    const a = messages[messages.length - 1];
    if (!a || a.role !== 'assistant' || !a.parts) return;
    a.parts.push({ type: 'tool', tool });
    this.messagesSubject.next([...messages]);
  }

  /** Met à jour le statut (et le résultat) d'un bloc outil par id. */
  private updateAssistantTool(id: string, status: ToolInvocation['status'], result?: string): void {
    const messages = this.messagesSubject.value;
    const a = messages[messages.length - 1];
    if (!a || a.role !== 'assistant' || !a.parts) return;
    for (let i = a.parts.length - 1; i >= 0; i--) {
      const p = a.parts[i];
      if (p.type === 'tool' && p.tool.id === id) {
        p.tool.status = status;
        if (result !== undefined) p.tool.result = result;
        break;
      }
    }
    this.messagesSubject.next([...messages]);
  }

  /**
   * Finalise un message en streaming
   */
  private finalizeStreamingMessage(): void {
    const messages = this.messagesSubject.value;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      lastMessage.isStreaming = false;
      this.statusSubject.next('');
      this.messagesSubject.next([...messages]);
      console.log('✅ Streaming message finalized');
    }
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
