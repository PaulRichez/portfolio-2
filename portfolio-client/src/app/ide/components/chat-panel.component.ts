import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AparteChatComponent, AparteSuggestionsDirective, aparteGlobalConfig } from '@aparte/angular';
import {
  AparteError, AparteErrorCode, uuid,
  type AparteMessage, type AparteSendEventDetail,
} from '@aparte/core';
import { fr } from '@aparte/locale-fr';
import { setupStreamingMarkdownProvider } from '@aparte/plugin-streaming-markdown';
import {
  default_renderer as smdRenderer, parser as smdParser, parser_end as smdEnd, parser_write as smdWrite,
} from 'streaming-markdown';
import { ChatbotService } from '../../services/chatbot.service';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { urlForFile } from '../models';

const CHAT_ID = 'ide-chat';

const INTRO_SUGGESTIONS = [
  'Quels sont tes projets ?',
  'Parle-moi de ton expérience',
  'Quelles technos maîtrises-tu ?',
];

/* Réglages globaux d'aparté, exécutés une fois au chargement (différé) de ce panneau. */
aparteGlobalConfig.setLocale({ ...fr, roleNameAssistant: 'Paul' });
setupStreamingMarkdownProvider();
/*
 * Rendu markdown « one-shot » avec le même parseur que le flux. Il sert à l'historique
 * restauré, et contourne un bug d'aparté 0.17 : sans rendu one-shot, la fin d'un tour
 * piloté par updateMessage() re-rend le texte en brut et efface le markdown streamé.
 */
aparteGlobalConfig.setMarkdownProvider((raw) => {
  const target = document.createElement('div');
  const parser = smdParser(smdRenderer(target));
  smdWrite(parser, raw);
  smdEnd(parser);
  return target.innerHTML;
});

/** Rouvre un fichier depuis la puce `open_file` : branché par le panneau actif. */
let reopenFile: ((path: string) => void) | null = null;

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
    button.addEventListener('click', () => reopenFile?.(path));
    return button;
  },
});

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

/**
 * Panneau de chat docké à droite (secondary sidebar) façon VS Code Copilot.
 * Rendu par aparté en mode « display-only » : la boucle d'agent tourne sur Strapi,
 * ce composant traduit ses événements SSE en messages et segments aparté.
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
      [messages]="restored()"
      placeholder="Posez une question à Paul…"
      (messagesChange)="messageCount.set($event.length)"
      (messageSent)="onSend($event)">
      <div slot="empty-state" class="intro">
        <img class="hero" src="assets/images/profile.jpg" alt="Paul" />
        <p>Salut 👋 Je suis l'assistant de <strong>Paul</strong>. Pose-moi tes questions sur son parcours, ses projets ou ses compétences.</p>
      </div>
      <aparte-suggestions slot="above-composer" target="ide-chat" [suggestions]="chipsJson()"></aparte-suggestions>
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
  private readonly chatHost = viewChild.required(AparteChatComponent, { read: ElementRef });

  readonly stylesReady = signal(false);
  /** Historique restauré au chargement ; remis à [] pour une nouvelle conversation. */
  readonly restored = signal<AparteMessage[]>([]);
  readonly messageCount = signal(0);
  private readonly live = signal<string[]>([]);

  /** Relances du serveur si présentes, sinon suggestions d'accueil sur une conversation vide. */
  readonly chipsJson = computed(() => JSON.stringify(
    this.live().length ? this.live() : (this.messageCount() === 0 ? INTRO_SUGGESTIONS : []),
  ));

  private turn: AbortController | null = null;

  constructor() {
    reopenFile = (path) => this.openFile(path);
    void loadAparteStyles().then(() => this.stylesReady.set(true));
    void this.restore();
  }

  newSession(): void {
    this.turn?.abort();
    this.api.newSession();
    this.live.set([]);
    this.messageCount.set(0);
    this.restored.set([]);
  }

  async onSend(event: AparteSendEventDetail): Promise<void> {
    const chat = this.chat();
    const id = uuid();
    const turn = new AbortController();
    this.turn = turn;
    this.live.set([]);

    this.lifecycle('aparte-message-start', { targetId: CHAT_ID, messageId: id, role: 'assistant' });
    chat.appendMessage({ id, role: 'assistant', timestamp: Date.now(), status: 'streaming', segments: [] });
    let textId = uuid();
    chat.addSegment({ id: textId, type: 'text', content: '' });
    const toolSegments = new Map<string, string>();

    try {
      for await (const ev of this.api.stream(event.content, turn.signal)) {
        switch (ev.type) {
          case 'chunk':
            if (ev.content) chat.appendToSegment(textId, ev.content);
            break;
          case 'tool_call': {
            const segmentId = `tool-${ev.id || uuid()}`;
            toolSegments.set(ev.id, segmentId);
            chat.addSegment({
              id: segmentId, type: 'tool_call', status: 'pending',
              toolCall: { id: segmentId, name: ev.name, input: ev.args ?? {} },
            });
            // le texte qui suit l'outil s'affiche APRÈS lui : nouveau segment texte
            textId = uuid();
            chat.addSegment({ id: textId, type: 'text', content: '' });
            break;
          }
          case 'tool_result': {
            const segmentId = toolSegments.get(ev.id);
            if (segmentId) chat.updateSegment(segmentId, { status: 'resolved', result: ev.result });
            break;
          }
          case 'open_file':
            this.openFile(ev.path);
            break;
          case 'suggestions':
            this.live.set(ev.content ?? []);
            break;
          case 'error':
            throw new Error(ev.message);
        }
      }
      chat.updateMessage(id, { status: 'completed' });
      this.lifecycle('aparte-message-done', { targetId: CHAT_ID, messageId: id, role: 'assistant' });
    } catch (err) {
      if (turn.signal.aborted) {
        chat.updateMessage(id, { status: 'completed' });
        this.lifecycle('aparte-message-aborted', { targetId: CHAT_ID });
      } else {
        const message = (err as Error)?.message || 'Erreur de connexion au chat.';
        chat.addSegment({ id: uuid(), type: 'error', content: message });
        chat.updateMessage(id, { status: 'error' });
        this.lifecycle('aparte-message-error', {
          targetId: CHAT_ID, messageId: id, error: new AparteError(message, AparteErrorCode.NET_ERROR),
        });
      }
    } finally {
      if (this.turn === turn) this.turn = null;
    }
  }

  /** Bouton Stop du composer : commande globale, filtrée sur ce chat. */
  @HostListener('window:aparte-abort', ['$event'])
  onAbort(event: CustomEvent<{ targetId?: string }>): void {
    if (event.detail?.targetId && event.detail.targetId !== CHAT_ID) return;
    this.turn?.abort();
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

  private async restore(): Promise<void> {
    const history = await this.api.history();
    if (!history.length) return;
    // [messages] ne déclenche pas (messagesChange) : on compte nous-mêmes pour masquer l'accueil
    this.messageCount.set(history.length);
    this.restored.set(history.map((m) => ({
      id: uuid(), role: m.role, content: m.content, timestamp: Date.now(), status: 'completed',
    })));
  }

  private openFile(path: string): void {
    if (this.vfs.exists(path)) void this.router.navigateByUrl(urlForFile(path));
  }

  /** Événements de cycle de vie qu'AparteClient émettrait : le composer bascule Envoyer/Stop dessus. */
  private lifecycle(name: string, detail: object): void {
    (this.chatHost().nativeElement as HTMLElement).dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true, detail }),
    );
  }
}
