import {
  ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatbotService, ToolInvocation, ChatMessage } from '../../services/chatbot.service';
import { MarkdownBlockComponent } from '../../shared/components/markdown-block.component';
import { IdeStateService } from '../services/ide-state.service';
import { VfsService } from '../services/vfs.service';
import { urlForFile } from '../models';

const INTRO_SUGGESTIONS = [
  'Quels sont tes projets ?',
  'Parle-moi de ton expérience',
  'Quelles technos maîtrises-tu ?',
];

/**
 * Panneau de chat docké à droite (secondary sidebar) façon VS Code Copilot.
 * Réutilise ChatbotService (streaming SSE). L'assistant répond « en tant que Paul ».
 */
@Component({
  selector: 'ide-chat-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MarkdownBlockComponent],
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

    <div class="messages" #scroll>
      @if (messages().length === 0) {
        <div class="intro">
          <img class="hero" src="assets/images/profile.jpg" alt="Paul" />
          <p>Salut 👋 Je suis l'assistant de <strong>Paul</strong>. Pose-moi tes questions sur son parcours, ses projets ou ses compétences.</p>
        </div>
      }
      @for (m of messages(); track $index) {
        @if (m.role === 'user') {
          <div class="msg user">
            <div class="who"><i class="codicon codicon-account"></i> Vous</div>
            <div class="bubble">{{ m.content }}</div>
          </div>
        } @else {
          <div class="msg">
            <div class="who"><img class="ava" src="assets/images/profile.jpg" alt="Paul" /> Paul</div>
            <div class="body">
              @if (m.parts) {
                @for (part of m.parts; track $index) {
                  @if (part.type === 'text') {
                    @if (part.content) {
                      <div class="bubble md">
                        <app-markdown-block [markdown]="part.content" />
                        @if (m.isStreaming && $last) { <span class="caret"></span> }
                      </div>
                    }
                  } @else {
                    <div class="tool-wrap">
                      <div class="tool" [class.done]="part.tool.status === 'done'" [class.err]="part.tool.status === 'error'"
                           [class.clickable]="!!part.tool.result" (click)="part.tool.result && toggleTool(part.tool.id)">
                        <i class="codicon"
                           [class.codicon-loading]="part.tool.status === 'running'"
                           [class.codicon-modifier-spin]="part.tool.status === 'running'"
                           [class.codicon-check]="part.tool.status === 'done'"
                           [class.codicon-error]="part.tool.status === 'error'"></i>
                        <span class="tlabel">{{ toolLabel(part.tool) }}</span>
                        @if (part.tool.result) {
                          <i class="codicon chev"
                             [class.codicon-chevron-down]="expanded().has(part.tool.id)"
                             [class.codicon-chevron-right]="!expanded().has(part.tool.id)"></i>
                        }
                      </div>
                      @if (part.tool.result && expanded().has(part.tool.id)) {
                        <pre class="tool-result">{{ part.tool.result }}</pre>
                      }
                    </div>
                  }
                }
                @if (showDots(m)) {
                  <div class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
                }
              } @else {
                <div class="bubble md" [class.error]="m.isError"><app-markdown-block [markdown]="m.content" /></div>
              }
            </div>
          </div>
        }
      }
    </div>

    @if (chips().length) {
      <div class="suggestions">
        @for (s of chips(); track s) {
          <button class="chip" (click)="pick(s)" [disabled]="loading()">{{ s }}</button>
        }
      </div>
    }

    <form class="composer" (submit)="$event.preventDefault(); send()">
      <textarea
        [(ngModel)]="draft" name="draft" rows="1"
        placeholder="Posez une question à Paul…"
        (keydown)="onKey($event)" [disabled]="loading()"></textarea>
      <button type="submit" class="send" [disabled]="loading() || !draft.trim()" aria-label="Envoyer">
        <i class="codicon" [class.codicon-send]="!loading()" [class.codicon-loading]="loading()" [class.codicon-modifier-spin]="loading()"></i>
      </button>
    </form>
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

    .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 16px; }
    .intro { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; opacity: .85; margin: auto 0; padding: 16px; font-size: 13px; }
    .intro .hero { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--ide-accent); }

    .msg { display: flex; flex-direction: column; gap: 4px; }
    .body { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .body .bubble.md { align-self: stretch; }
    .who { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; opacity: .7; }
    .who .ava { width: 16px; height: 16px; border-radius: 50%; object-fit: cover; }
    .who .codicon { font-size: 14px; }
    .bubble { font-size: 13px; line-height: 1.55; }
    .msg.user .bubble {
      align-self: flex-start; background: var(--ide-selection); padding: 7px 11px;
      border-radius: 4px; white-space: pre-wrap; word-break: break-word;
    }
    .bubble.error { color: #e05252; }
    .caret { display: inline-block; width: 7px; height: 14px; background: var(--ide-accent); vertical-align: text-bottom; margin-left: 2px; animation: blink 1s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }

    .tool {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
      font-family: var(--ide-mono); font-size: 11.5px; padding: 4px 9px; border-radius: 5px;
      background: var(--ide-hover); border: 1px solid var(--ide-border); color: var(--ide-editor-muted);
    }
    .tool.done { color: var(--ide-sidebar-fg); }
    .tool.err { color: #e05252; }
    .tool.clickable { cursor: pointer; }
    .tool.clickable:hover { border-color: var(--ide-accent); }
    .tool .codicon { font-size: 13px; }
    .tool.done .codicon { color: #3fb950; }
    .tool .chev { margin-left: 2px; opacity: .6; }
    .tlabel { word-break: break-all; }
    .tool-wrap { display: flex; flex-direction: column; gap: 4px; align-self: flex-start; max-width: 100%; }
    .tool-result {
      margin: 0; padding: 8px 10px; border-radius: 5px; background: var(--ide-editor-bg);
      border: 1px solid var(--ide-border); color: var(--ide-editor-muted);
      font-family: var(--ide-mono); font-size: 11px; line-height: 1.5;
      max-height: 180px; overflow: auto; white-space: pre-wrap; word-break: break-word;
    }

    .thinking { display: inline-flex; gap: 5px; padding: 5px 2px; }
    .thinking .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ide-editor-muted); animation: bounce 1.2s infinite; }
    .thinking .dot:nth-child(2) { animation-delay: .2s; }
    .thinking .dot:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

    .suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 0; flex: none; }
    .chip {
      font-size: 12px; padding: 4px 10px; border-radius: 999px; cursor: pointer;
      background: transparent; border: 1px solid var(--ide-border); color: inherit;
    }
    .chip:hover:not(:disabled) { background: var(--ide-hover); border-color: var(--ide-accent); }
    .chip:disabled { opacity: .5; cursor: default; }

    .composer { display: flex; align-items: flex-end; gap: 6px; padding: 12px; flex: none; }
    textarea {
      flex: 1; resize: none; max-height: 140px; font-family: inherit; font-size: 13px;
      padding: 8px 10px; border-radius: 6px; border: 1px solid var(--ide-border);
      background: var(--ide-editor-bg); color: var(--ide-editor-fg); outline: none;
    }
    textarea:focus { border-color: var(--ide-accent); }
    .send {
      display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;
      border: none; border-radius: 6px; cursor: pointer; background: var(--ide-accent); color: #fff;
    }
    .send:disabled { opacity: .4; cursor: default; }

    @media (max-width: 768px) {
      :host { position: absolute; inset: 0 0 0 48px; z-index: 40; width: auto; }
    }
  `],
})
export class ChatPanelComponent {
  private readonly chat = inject(ChatbotService);
  readonly state = inject(IdeStateService);
  private readonly vfs = inject(VfsService);
  private readonly router = inject(Router);

  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');

  readonly messages = toSignal(this.chat.messages$, { initialValue: [] });
  readonly loading = toSignal(this.chat.loading$, { initialValue: false });
  readonly status = toSignal(this.chat.status$, { initialValue: '' });
  private readonly liveSuggestions = toSignal(this.chat.suggestions$, { initialValue: [] as string[] });

  /** Ids des chips d'outils dépliés (pour voir le contenu lu). */
  readonly expanded = signal<Set<string>>(new Set());

  toggleTool(id: string): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  draft = '';

  /** Suggestions live si présentes, sinon suggestions d'accueil quand la conversation est vide. */
  readonly chips = signal<string[]>(INTRO_SUGGESTIONS);

  constructor() {
    effect(() => {
      const live = this.liveSuggestions();
      this.chips.set(live.length ? live : (this.messages().length === 0 ? INTRO_SUGGESTIONS : []));
    });
    // auto-scroll en bas à chaque nouveau contenu
    effect(() => {
      this.messages(); this.loading();
      const el = this.scroll()?.nativeElement;
      if (el) queueMicrotask(() => { el.scrollTop = el.scrollHeight; });
    });
    // l'IA demande d'ouvrir un fichier (tool open_file) → on ouvre l'onglet
    this.chat.openFile$.pipe(takeUntilDestroyed()).subscribe((path) => {
      if (this.vfs.exists(path)) this.router.navigateByUrl(urlForFile(path));
    });
  }

  toolLabel(tool: ToolInvocation): string {
    const p = tool.args?.path;
    return `${tool.name}(${p ? '"' + p + '"' : ''})`;
  }

  /** Points « réfléchit » : streaming en cours mais dernier bloc = outil terminé (ou rien encore). */
  showDots(m: ChatMessage): boolean {
    if (!m.isStreaming) return false;
    const parts = m.parts ?? [];
    const last = parts[parts.length - 1];
    if (!last) return true;
    return last.type === 'tool' && last.tool.status !== 'running';
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.loading()) return;
    this.draft = '';
    this.chat.sendMessage(text).subscribe({ error: () => {} });
  }

  pick(s: string): void {
    if (this.loading()) return;
    this.draft = s;
    this.send();
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  newSession(): void {
    this.chat.createNewSession();
  }
}
