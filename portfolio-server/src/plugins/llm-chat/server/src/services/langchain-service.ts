import type { Core } from '@strapi/strapi';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate, MessagesPlaceholder, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
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

const langchainService = ({ strapi }: { strapi: Core.Strapi }) => {
  // Stocker les conversations en mémoire (dans une application réelle, utilisez une base de données)
  const conversations = new Map();

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

  return {    // Créer une nouvelle conversation ou continuer une existante
    async chat(message: string, options?: ConversationOptions) {
      try {
        // Get the plugin configuration with proper error handling
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
        if (!conversations.has(sessionId)) {
          // Créer une nouvelle chaîne de conversation avec mémoire
          const memory = new BufferMemory({
            returnMessages: true,
            memoryKey: "history",
          });

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

          conversations.set(sessionId, { chain, messages: [] });
        }

        // Récupérer la conversation existante
        const conversation = conversations.get(sessionId);

        // Appeler la chaîne et obtenir une réponse
        const response = await conversation.chain.call({
          input: message,
        });

        // Ajouter les messages à l'historique
        conversation.messages.push(
          new HumanMessage(message),
          new AIMessage(response.response)
        );

        return {
          sessionId,
          response: response.response,
          history: conversation.messages,
        };
      } catch (error) {
        strapi.log.error('Error in langchain chat service:', error);
        throw error;
      }
    },

    // Obtenir l'historique d'une conversation
    getHistory(sessionId: string = 'default') {
      if (!conversations.has(sessionId)) {
        return {
          sessionId,
          messages: [],
          messageCount: 0,
          lastActivity: null
        };
      }
      const conversation = conversations.get(sessionId);
      return {
        sessionId,
        messages: conversation.messages,
        messageCount: conversation.messages.length,
        lastActivity: conversation.messages.length > 0
          ? conversation.messages[conversation.messages.length - 1].timestamp || new Date().toISOString()
          : null
      };
    },

    // Obtenir toutes les sessions actives
    getAllSessions() {
      const sessions = [];
      for (const [sessionId, conversation] of conversations.entries()) {
        sessions.push({
          sessionId,
          messageCount: conversation.messages.length,
          lastActivity: conversation.messages.length > 0
            ? conversation.messages[conversation.messages.length - 1].timestamp || new Date().toISOString()
            : new Date().toISOString(),
          lastMessage: conversation.messages.length > 0
            ? conversation.messages[conversation.messages.length - 1].content.slice(0, 100) + '...'
            : 'No messages'
        });
      }
      return sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    },

    // Effacer l'historique d'une conversation
    clearHistory(sessionId: string = 'default') {
      if (conversations.has(sessionId)) {
        conversations.delete(sessionId);
        return true;
      }
      return false;
    },

    // Effacer toutes les conversations
    clearAllHistory() {
      const count = conversations.size;
      conversations.clear();
      return { cleared: count };
    },
  };
};

export default langchainService;
