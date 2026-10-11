import {
  ChangeDetectionStrategy, Component, HostListener, computed, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AparteChatComponent, AparteSuggestionsDirective, aparteGlobalConfig } from '@aparte/angular';
import {
  AparteClient, AparteConversationManager, createAgentStreamRunner, contentToText,
  type AparteConversation, type AparteMessage, type AparteStorageAdapter,
} from '@aparte/core';
import { fr } from '@aparte/locale-fr';
import { setupStreamingMarkdownProvider } from '@aparte/plugin-streaming-markdown';
import { environment } from '../../../environments/environment';
import { ChatbotService } from '../../services/chatbot.service';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { urlForFile } from '../models';

const INTRO_SUGGESTIONS = [
  'Quels sont tes projets ?',
  'Parle-moi de ton expérience',
  'Quelles technos maîtrises-tu ?',
];

/** Conversation affichée, retrouvée au rechargement. */
const ACTIVE_KEY = 'ide-chat-conversation';
const STORE_KEY = 'ide-chat-conversations';
const MAX_STORED = 5;

/* Réglages globaux d'aparté, exécutés une fois au chargement (différé) de ce panneau. */
aparteGlobalConfig.setLocale({ ...fr, roleNameAssistant: 'Paul' });
setupStreamingMarkdownProvider();
/* La ligne d'outil par défaut affiche le fichier lu après le nom : `read_file skills.json`. */
aparteGlobalConfig.registerToolSummary('read_file', (segment) => String(segment.toolCall.input?.['path'] ?? ''));

/** Ouvre un fichier dans l'éditeur : branché par le panneau actif. */
let openInEditor: ((path: string) => boolean) | null = null;

/* Ligne de l'outil open_file dans le chat : une puce qui rouvre le fichier. */
aparteGlobalConfig.registerToolRenderer('open_file', {
  render: (segment) => {
    const path = String(segment.toolCall.input?.['path'] ?? '');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ide-open-file';
    button.title = 'Rouvrir dans l’éditeur';
    const icon = document.createElement('i');
    icon.className = 'codicon codicon-go-to-file';
    button.append(icon, document.createTextNode(path));
    button.addEventListener('click', () => openInEditor?.(path));
    return button;
  },
});

/** Conversations gardées dans le navigateur : les plus récentes seulement. */
class LocalConversations implements AparteStorageAdapter {
  async loadAll(): Promise<AparteConversation[]> {
    return this.read().sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async save(conv: AparteConversation): Promise<void> {
    this.write([...this.read().filter((c) => c.id !== conv.id), conv]);
  }
  async delete(id: string): Promise<void> {
    this.write(this.read().filter((c) => c.id !== id));
  }
  private read(): AparteConversation[] {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); } catch { return []; }
  }
  private write(all: AparteConversation[]): void {
    const kept = all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_STORED);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(kept)); } catch { /* quota, navigation privée */ }
  }
}

const conversations = new AparteConversationManager(new LocalConversations(), { retention: { maxMessages: 60 } });
const conversationsReady = conversations.init().then(() => aparteGlobalConfig.setConversationManager(conversations));

/*
 * La boucle d'agent tourne sur Strapi (createAparteAgentHandler) : le client relaie et dessine.
 * open_file y est un outil serveur qui confirme seulement ; la page ouvre le fichier en voyant
 * passer l'appel dans les événements du tour. Un tour en direct seulement : une conversation
 * rechargée ne rejoue pas ces événements, donc ne rouvre rien.
 */
const agentRunner = createAgentStreamRunner({ endpoint: `${environment.apiUrl}/chat/agent` });
new AparteClient({
  streamRunner: (opts) => agentRunner({
    ...opts,
    emitter: (event) => {
      if (event.type === 'tool-start' && event.name === 'open_file') {
        openInEditor?.(String((event.input as { path?: unknown } | undefined)?.path ?? ''));
      }
      opts.emitter(event);
    },
  }),
}).start();

/** Feuille d'aparté + thème IDE, émises à part par le build (angular.json, bundle `aparte`). */
function loadAparteStyles(): Promise<void> {
  const existing = document.getElementById('aparte-styles') as HTMLLinkElement | null;
  if (existing?.sheet) return Promise.resolve();
  const link = existing ?? Object.assign(document.createElement('link'), {
    id: 'aparte-styles', rel: 'stylesheet', href: 'aparte.css',
  });
  const ready = new Promise<void>((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
  if (!existing) document.head.appendChild(link);
  return ready;
}

/** Texte affiché d'un message : son contenu, ou ses segments de texte. */
function textOf(message: AparteMessage | undefined): string {
  if (!message) return '';
  const fromSegments = (message.segments ?? [])
    .map((s) => (s.type === 'text' ? s.content : ''))
    .join('');
  return fromSegments || contentToText(message.content ?? '');
}

/**
 * Panneau de chat docké à droite (secondary sidebar) façon VS Code Copilot.
 * Tout le chat est aparté : la boucle d'agent tourne sur Strapi, la page relaie,
 * dessine, ouvre les fichiers que l'assistant montre et garde les conversations.
 */
@Component({
  selector: 'ide-chat-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AparteChatComponent, AparteSuggestionsDirective],
  host: { '[class.ready]': 'stylesReady()' },
  template: `
    <header>
      <span class="title"><i class="codicon codicon-comment-discussion"></i> Chat</span>
      <div class="actions">
        <button (click)="newSession()" title="Nouvelle conversation" aria-label="Nouvelle conversation">
          <i class="codicon codicon-add"></i>
        </button>
        <button (click)="state.toggleChat()" title="Fermer" aria-label="Fermer">
          <i class="codicon codicon-close"></i>
        </button>
      </div>
    </header>

    <aparte-chat
      id="ide-chat"
      [conversationId]="conversationId()"
      (conversationCreated)="onConversationCreated($event)"
      placeholder="Posez une question à Paul…">
      <div slot="empty-state" class="intro">
        <img class="hero" src="assets/images/profile.jpg" alt="Paul" />
        <p>Salut 👋 Je suis l'assistant de <strong>Paul</strong>. Pose-moi tes questions sur son parcours, ses projets ou ses compétences.</p>
      </div>
      <!-- accueil : visible tant que la conversation est vide (restaurée ou nouvelle comprise) -->
      <aparte-suggestions slot="above-composer" target="ide-chat" empty-only [suggestions]="introJson"></aparte-suggestions>
      <!-- relances proposées par le serveur après une réponse ; masqué tant qu'il n'y en a pas -->
      <aparte-suggestions slot="above-composer" target="ide-chat" [suggestions]="liveJson()"></aparte-suggestions>
    </aparte-chat>
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column;
      /* largeur souhaitée, mais plafonnée à 40% du viewport sur écran étroit */
      width: min(var(--ide-chat-w, 360px), 40vw); flex: none;
      background: var(--ide-sidebar-bg); border-left: 1px solid var(--ide-border);
      color: var(--ide-sidebar-fg); min-height: 0;
    }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 8px 6px 12px; flex: none; border-bottom: 1px solid var(--ide-border);
    }
    .title { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; opacity: .8; }
    .actions { display: flex; gap: 2px; }
    .actions button { background: none; border: none; color: inherit; cursor: pointer; padding: 4px; border-radius: 4px; }
    .actions button:hover { background: var(--ide-hover); }

    aparte-chat { flex: 1; min-height: 0; }
    /* pas de flash sans style : le chat apparaît une fois la feuille d'aparté chargée */
    :host(:not(.ready)) aparte-chat { visibility: hidden; }

    .intro { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; opacity: .85; padding: 16px; font-size: 13px; }
    .intro p { margin: 0; }
    .intro .hero { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--ide-accent); }

    @media (max-width: 768px) {
      :host { position: absolute; inset: 0 0 0 48px; z-index: 40; width: auto; }
    }
  `],
})
export class ChatPanelComponent {
  private readonly api = inject(ChatbotService);
  readonly state = inject(IdeStateService);
  private readonly vfs = inject(VfsService);
  private readonly router = inject(Router);

  private readonly chat = viewChild.required(AparteChatComponent);

  readonly stylesReady = signal(false);
  /** Conversation chargée dans le chat ; null = nouvelle conversation, créée au premier envoi. */
  readonly conversationId = signal<string | null>(null);
  private readonly live = signal<string[]>([]);

  readonly introJson = JSON.stringify(INTRO_SUGGESTIONS);
  readonly liveJson = computed(() => JSON.stringify(this.live()));

  /** Tour en cours : seules ses relances sont affichées. */
  private turnId: string | null = null;

  constructor() {
    openInEditor = (path) => {
      if (!this.vfs.exists(path)) return false;
      void this.router.navigateByUrl(urlForFile(path));
      return true;
    };
    void loadAparteStyles().then(() => this.stylesReady.set(true));
    void conversationsReady.then(() => {
      const saved = readActive();
      if (saved && conversations.conversations.some((c) => c.id === saved)) this.conversationId.set(saved);
    });
  }

  newSession(): void {
    this.live.set([]);
    this.conversationId.set(null);
    writeActive(null);
  }

  onConversationCreated(id: string): void {
    this.conversationId.set(id);
    writeActive(id);
  }

  @HostListener('aparte-message-start', ['$event'])
  onTurnStart(event: CustomEvent<{ messageId?: string; role?: string }>): void {
    if (event.detail?.role !== 'assistant') return;
    this.turnId = event.detail.messageId ?? null;
    this.live.set([]);
  }

  /** Fin d'un tour : on demande des relances à partir de la question et de la réponse. */
  @HostListener('aparte-message-done', ['$event'])
  onTurnDone(event: CustomEvent<{ messageId?: string; role?: string }>): void {
    if (event.detail?.role !== 'assistant') return;
    const messageId = event.detail.messageId ?? null;
    const messages = this.chat().getMessages();
    const index = messages.findIndex((m) => m.id === messageId);
    const answer = textOf(messages[index]);
    const question = textOf(messages.slice(0, Math.max(index, 0)).reverse().find((m) => m.role === 'user'));
    if (!question || !answer) return;
    void this.api.suggestions(question, answer).then((s) => {
      if (this.turnId === messageId) this.live.set(s);
    });
  }

  /** Liens internes des réponses (ex. /projects/...) : navigation SPA, sans rechargement. */
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || !href.startsWith('/') || href.startsWith('//') || anchor.target === '_blank') return;
    event.preventDefault();
    void this.router.navigateByUrl(href);
  }
}

function readActive(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

function writeActive(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* navigation privée */ }
}
