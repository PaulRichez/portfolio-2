import type { Core } from '@strapi/strapi';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate, MessagesPlaceholder, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { ConversationChain } from "langchain/chains";
import { BaseChatMemory } from "langchain/memory";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";

// Interface pour définir la structure de la configuration
interface LlmChatConfig {
  provider: 'openai' | 'custom';
  openai: {
    apiKey: string;
    modelName: string;
    temperature: number;
  };
  custom: {
    baseUrl: string;
    modelName: string;
    temperature: number;
    apiKey: string;
  };
}

// Interface pour les options de conversation
interface ConversationOptions {
  sessionId?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

// Mémoire personnalisée utilisant Strapi
class StrapiChatMemory extends BaseChatMemory {
  private strapi: Core.Strapi;
  private sessionId: string;

  constructor(strapi: Core.Strapi, sessionId: string) {
    super({ returnMessages: true, inputKey: "input", outputKey: "response" });
    this.strapi = strapi;
    this.sessionId = sessionId;
  }

  get memoryKeys() {
    return ["history"];
  }

  async loadMemoryVariables() {
    const messages = await this.getChatMessages();
    return { history: messages };
  }

  async saveContext(inputValues: Record<string, any>, outputValues: Record<string, any>) {
    const input = inputValues[this.inputKey];
    const output = outputValues[this.outputKey];

    // Sauvegarder le message utilisateur
    await this.strapi.entityService.create('plugin::llm-chat.chat-message', {
      data: {
        sessionId: this.sessionId,
        role: 'user',
        content: input,
        timestamp: new Date().toISOString()
      }
    });

    // Sauvegarder la réponse de l'assistant
    await this.strapi.entityService.create('plugin::llm-chat.chat-message', {
      data: {
        sessionId: this.sessionId,
        role: 'assistant',
        content: output,
        timestamp: new Date().toISOString()
      }
    });
  }

  async getChatMessages(): Promise<BaseMessage[]> {
    const messages = await this.strapi.entityService.findMany('plugin::llm-chat.chat-message', {
      filters: { sessionId: this.sessionId },
      sort: { createdAt: 'asc' }
    });

    return messages.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });
  }

  async clear() {
    const messages = await this.strapi.entityService.findMany('plugin::llm-chat.chat-message', {
      filters: { sessionId: this.sessionId }
    }) as any[];

    for (const message of messages) {
      await this.strapi.entityService.delete('plugin::llm-chat.chat-message', message.id);
    }
  }
}

const langchainService = ({ strapi }: { strapi: Core.Strapi }) => {
  // Stocker les chaînes de conversation en cache
  const conversationChains = new Map();

  // Créer un modèle en fonction de la configuration
  const createModel = (config: LlmChatConfig, options?: ConversationOptions) => {
    const temperature = options?.temperature !== undefined
      ? Number(options.temperature)
      : Number(config.provider === 'openai' ? config.openai.temperature : config.custom.temperature);

    if (config.provider === 'openai') {
      return new ChatOpenAI({
        modelName: config.openai.modelName,
        temperature: temperature,
        openAIApiKey: config.openai.apiKey,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
      });
    } else if (config.provider === 'custom') {
      return new ChatOpenAI({
        modelName: config.custom.modelName,
        temperature: temperature,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
        configuration: {
          baseURL: config.custom.baseUrl,
          apiKey: config.custom.apiKey || "not-needed",
        },
      });
    } else {
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  };

  return {
    // Créer une nouvelle conversation ou continuer une existante
    async chat(message: string, options?: ConversationOptions) {
      try {
        const pluginConfig = strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default');

        if (!pluginConfig) {
          throw new Error('LLM Chat plugin configuration not found');
        }

        const config = pluginConfig as LlmChatConfig;

        if (!config.provider) {
          throw new Error('LLM provider not configured');
        }

        const sessionId = options?.sessionId || 'default';
        const model = createModel(config, options);

        // Récupérer ou créer une conversation
        if (!conversationChains.has(sessionId)) {
          // Créer une mémoire personnalisée utilisant Strapi
          const memory = new StrapiChatMemory(strapi, sessionId);

          const systemPrompt = options?.systemPrompt || "You are a helpful AI assistant.";
          const chatPrompt = ChatPromptTemplate.fromMessages([
            ["system", systemPrompt],
            new MessagesPlaceholder("history"),
            HumanMessagePromptTemplate.fromTemplate("{input}"),
          ]);

          const chain = new ConversationChain({
            memory: memory,
            prompt: chatPrompt,
            llm: model,
          });

          conversationChains.set(sessionId, chain);
        }

        // Récupérer la conversation existante
        const chain = conversationChains.get(sessionId);

        // Appeler la chaîne et obtenir une réponse
        const response = await chain.call({
          input: message,
        });

        // Récupérer l'historique depuis la base de données
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { sessionId },
          sort: { createdAt: 'asc' }
        });

        return {
          sessionId,
          response: response.response,
          history: messages,
        };
      } catch (error) {
        strapi.log.error('Error in langchain chat service:', error);
        throw error;
      }
    },

    // Obtenir l'historique d'une conversation
    async getHistory(sessionId: string = 'default') {
      try {
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { sessionId },
          sort: { createdAt: 'asc' }
        });

        return {
          sessionId,
          messages,
          messageCount: messages.length,
          lastActivity: messages.length > 0 ? messages[messages.length - 1].timestamp : null
        };
      } catch (error) {
        strapi.log.error('Error getting history:', error);
        return {
          sessionId,
          messages: [],
          messageCount: 0,
          lastActivity: null
        };
      }
    },

    // Obtenir toutes les sessions actives
    async getAllSessions() {
      try {
        // Récupérer toutes les sessions distinctes
        const sessions = await strapi.db.query('plugin::llm-chat.chat-session').findMany({
          orderBy: { updatedAt: 'desc' }
        });

        return sessions.map(session => ({
          sessionId: session.sessionId,
          title: session.title || null,
          messageCount: session.messageCount || 0,
          lastActivity: session.lastActivity || session.updatedAt,
          lastMessage: session.lastMessage || 'No messages'
        }));
      } catch (error) {
        strapi.log.error('Error getting all sessions:', error);
        return [];
      }
    },

    // Effacer l'historique d'une conversation
    async clearHistory(sessionId: string = 'default') {
      try {
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { sessionId }
        }) as any[];

        for (const message of messages) {
          await strapi.entityService.delete('plugin::llm-chat.chat-message', message.id);
        }

        // Supprimer aussi la session
        const sessions = await strapi.entityService.findMany('plugin::llm-chat.chat-session', {
          filters: { sessionId }
        }) as any[];

        for (const session of sessions) {
          await strapi.entityService.delete('plugin::llm-chat.chat-session', session.id);
        }

        // Supprimer de la cache
        conversationChains.delete(sessionId);

        return true;
      } catch (error) {
        strapi.log.error('Error clearing history:', error);
        return false;
      }
    },

    // Effacer toutes les conversations
    async clearAllHistory() {
      try {
        const sessions = await strapi.entityService.findMany('plugin::llm-chat.chat-session') as any[];
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message') as any[];

        // Supprimer tous les messages
        for (const message of messages) {
          await strapi.entityService.delete('plugin::llm-chat.chat-message', message.id);
        }

        // Supprimer toutes les sessions
        for (const session of sessions) {
          await strapi.entityService.delete('plugin::llm-chat.chat-session', session.id);
        }

        conversationChains.clear();

        return { cleared: sessions.length };
      } catch (error) {
        strapi.log.error('Error clearing all history:', error);
        return { cleared: 0 };
      }
    },

    // Nouvelle méthode pour le streaming
    async streamChat(message: string, options?: ConversationOptions) {
      try {
        const pluginConfig = strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default');

        if (!pluginConfig) {
          throw new Error('LLM Chat plugin configuration not found');
        }

        const config = pluginConfig as LlmChatConfig;
        const sessionId = options?.sessionId || 'default';

        // Créer le modèle avec streaming activé
        const temperature = options?.temperature !== undefined
          ? Number(options.temperature)
          : Number(config.provider === 'openai' ? config.openai.temperature : config.custom.temperature);

        let model;
        if (config.provider === 'openai') {
          model = new ChatOpenAI({
            modelName: config.openai.modelName,
            temperature: temperature,
            openAIApiKey: config.openai.apiKey,
            maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
            streaming: true,
          });
        } else if (config.provider === 'custom') {
          model = new ChatOpenAI({
            modelName: config.custom.modelName,
            temperature: temperature,
            maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
            streaming: true,
            configuration: {
              baseURL: config.custom.baseUrl,
              apiKey: config.custom.apiKey || "not-needed",
            },
          });
        } else {
          throw new Error(`Unsupported LLM provider: ${config.provider}`);
        }

        // Récupérer ou créer une conversation
        if (!conversationChains.has(sessionId)) {
          const memory = new StrapiChatMemory(strapi, sessionId);

          const systemPrompt = options?.systemPrompt || "You are a helpful AI assistant.";
          const chatPrompt = ChatPromptTemplate.fromMessages([
            ["system", systemPrompt],
            new MessagesPlaceholder("history"),
            HumanMessagePromptTemplate.fromTemplate("{input}"),
          ]);

          const chain = new ConversationChain({
            memory: memory,
            prompt: chatPrompt,
            llm: model,
          });

          conversationChains.set(sessionId, chain);
        }

        const chain = conversationChains.get(sessionId);

        // Retourner un générateur pour le streaming
        return {
          async *stream() {
            let fullResponse = '';

            try {
              const stream = await chain.stream(
                { input: message },
                {
                  callbacks: [{
                    handleLLMNewToken(token) {
                      fullResponse += token;
                      return token;
                    }
                  }]
                }
              );

              for await (const chunk of stream) {
                if (chunk.response) {
                  yield `data: ${JSON.stringify({ content: chunk.response })}\n\n`;
                }
              }

              yield `data: [DONE]\n\n`;
            } catch (error) {
              yield `data: ${JSON.stringify({ error: error.message })}\n\n`;
            }
          },
          sessionId,
        };
      } catch (error) {
        strapi.log.error('Error in langchain stream service:', error);
        throw error;
      }
    },

    // Supprimer une session
    async deleteSession(sessionId: string) {
      try {
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { sessionId }
        }) as any[];

        for (const message of messages) {
          await strapi.entityService.delete('plugin::llm-chat.chat-message', message.id);
        }

        const sessions = await strapi.entityService.findMany('plugin::llm-chat.chat-session', {
          filters: { sessionId }
        }) as any[];

        for (const session of sessions) {
          await strapi.entityService.delete('plugin::llm-chat.chat-session', session.id);
        }

        conversationChains.delete(sessionId);

        return true;
      } catch (error) {
        strapi.log.error('Error deleting session:', error);
        return false;
      }
    },

    // Mettre à jour le titre d'une session
    async updateSessionTitle(sessionId: string, title: string) {
      try {
        // Vérifier si la session existe
        const existingSession = await strapi.entityService.findMany('plugin::llm-chat.chat-session', {
          filters: { sessionId }
        }) as any[];

        if (existingSession.length > 0) {
          // Mettre à jour la session existante
          await strapi.entityService.update('plugin::llm-chat.chat-session', existingSession[0].id, {
            data: { title } as any
          });
        } else {
          // Créer une nouvelle session
          await strapi.entityService.create('plugin::llm-chat.chat-session', {
            data: {
              sessionId,
              title,
              messageCount: 0,
              lastActivity: new Date().toISOString(),
              lastMessage: 'New session'
            } as any
          });
        }

        return true;
      } catch (error) {
        strapi.log.error('Error updating session title:', error);
        return false;
      }
    },
  };
};

export default langchainService;
