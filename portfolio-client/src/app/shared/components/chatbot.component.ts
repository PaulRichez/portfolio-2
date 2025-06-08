import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextarea } from 'primeng/inputtextarea';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

import { ChatbotService, ChatMessage } from '../../services/chatbot.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextarea,
    ScrollPanelModule,
    ProgressSpinnerModule,
    TooltipModule,
    AvatarModule,
    DividerModule
  ],
  providers: [MessageService]
})
export class ChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  visible = false;
  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;

  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(private chatbotService: ChatbotService, private messageService: MessageService) {}

  ngOnInit(): void {
    // Subscribe to messages
    this.subscriptions.push(
      this.chatbotService.messages$.subscribe(messages => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
      })
    );

    // Subscribe to loading state
    this.subscriptions.push(
      this.chatbotService.loading$.subscribe(loading => {
        this.isLoading = loading;
        if (loading) {
          this.shouldScrollToBottom = true;
        }
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Ouvre le chatbot
   */
  open(): void {
    this.visible = true;
    this.loadHistory();
  }

  /**
   * Ferme le chatbot
   */
  close(): void {
    this.visible = false;
  }

  /**
   * Gère la fermeture du dialog
   */
  onHide(): void {
    this.visible = false;
  }

  /**
   * Charge l'historique de la conversation
   */
  private loadHistory(): void {
    this.chatbotService.getHistory().subscribe({
      next: (response) => {
        if (response.messages && Array.isArray(response.messages)) {
          this.chatbotService.updateMessages(response.messages);
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'historique:', error);
      }
    });
  }
  /**
   * Envoie un message
   */
  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) {
      return;
    }

    const messageToSend = this.currentMessage.trim();
    this.currentMessage = '';

    // Activer le state de chargement
    this.chatbotService.setLoading(true);

    // Envoyer le message au service avec streaming
    // Le service se charge d'ajouter le message utilisateur et la réponse
    this.chatbotService.sendMessage(messageToSend).subscribe({
      next: (response) => {
        // Le streaming est terminé, le message final est déjà ajouté via updateStreamingMessage
        this.chatbotService.setLoading(false);
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi du message:', error);
        this.chatbotService.setLoading(false);

        // Ajouter un message d'erreur
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
          timestamp: new Date().toISOString()
        };
        this.chatbotService.addMessage(errorMessage);
      }
    });
  }

  /**
   * Gère les touches du clavier
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Efface l'historique de la conversation
   */
  clearHistory(): void {
    this.chatbotService.clearHistory().subscribe({
      next: (response) => {
        console.log('✅ Historique effacé:', response);
        // L'historique est automatiquement effacé par le service
        // qui crée une nouvelle session et reset les messages
        this.messageService.add({
          severity: 'success',
          summary: 'Historique effacé',
          detail: 'L\'historique de la conversation a été supprimé.',
          life: 3000
        });
      },
      error: (error) => {
        console.error('❌ Erreur lors de l\'effacement de l\'historique:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'effacer l\'historique de la conversation.',
          life: 3000
        });
      }
    });
  }

  /**
   * Pose une question rapide
   */
  askQuickQuestion(question: string): void {
    this.currentMessage = question;
    this.sendMessage();
  }

  /**
   * Formate le temps d'affichage
   */
  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formate le message avec support HTML basique
   */
  formatMessage(content: string): string {
    // Remplace les liens par des liens cliquables
    return content
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  /**
   * TrackBy pour optimiser la liste des messages
   */
  trackByIndex(index: number, item: ChatMessage): number {
    return index;
  }

  /**
   * Fait défiler vers le bas
   */
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Erreur lors du scroll:', err);
    }
  }
}
