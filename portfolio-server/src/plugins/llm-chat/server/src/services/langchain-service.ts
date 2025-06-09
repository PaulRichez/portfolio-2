import type { Core } from '@strapi/strapi';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate, MessagesPlaceholder, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { ConversationChain } from "langchain/chains";
import { BaseChatMemory } from "langchain/memory";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
// Imports pour les outils LangChain
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { SmartRAGTool } from "../tools";
import { SYSTEM_PROMPT } from "../prompts/system-prompt";

// Interface pour définir la structure de la configuration
export interface LlmChatConfig {
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
export interface ConversationOptions {
  sessionId?: string;
  maxTokens?: number;
  useRAG?: boolean; // Nouvelle option pour activer/désactiver RAG
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

    const timerId = `💾 Save Context [${this.sessionId}]`;
    console.time(timerId);
    this.strapi.log.info('💾 Saving context for session:', this.sessionId);
    console.log('User message:', input.substring(0, 50) + '...');
    console.log('Assistant response:', output.substring(0, 50) + '...');

    try {
      // Vérifier que le content-type existe
      const messageContentType = this.strapi.contentType('plugin::llm-chat.chat-message');
      if (!messageContentType) {
        throw new Error('Content type plugin::llm-chat.chat-message not found');
      }
      console.log('✅ Content type chat-message found');

      // Sauvegarder le message utilisateur
      const userMessage = await this.strapi.entityService.create('plugin::llm-chat.chat-message', {
        data: {
          sessionId: this.sessionId,
          role: 'user',
          content: input,
          timestamp: new Date().toISOString()
        }
      });
      this.strapi.log.info('✅ User message saved with ID:', userMessage.id);
      console.log('✅ User message saved with ID:', userMessage.id);

      // Sauvegarder la réponse de l'assistant
      const assistantMessage = await this.strapi.entityService.create('plugin::llm-chat.chat-message', {
        data: {
          sessionId: this.sessionId,
          role: 'assistant',
          content: output,
          timestamp: new Date().toISOString()
        }
      });
      this.strapi.log.info('✅ Assistant message saved with ID:', assistantMessage.id);
      console.log('✅ Assistant message saved with ID:', assistantMessage.id);

      // Créer ou mettre à jour la session
      await this.updateOrCreateSession(input, output);

      console.timeEnd(timerId);
    } catch (error) {
      console.timeEnd(timerId);
      this.strapi.log.error('❌ Error saving messages:', error);
      console.error('❌ Error saving messages:', error);
      throw error;
    }
  }

  async updateOrCreateSession(userMessage: string, assistantResponse: string) {
    const timerId = `📝 Update Session [${this.sessionId}]`;
    console.time(timerId);

    try {
      console.log('🔄 Updating session:', this.sessionId);

      // Vérifier si la session existe
      const existingSession = await this.strapi.entityService.findMany('plugin::llm-chat.chat-session', {
        filters: { sessionId: this.sessionId }
      }) as any[];

      const messageCount = await this.strapi.entityService.count('plugin::llm-chat.chat-message', {
        filters: { sessionId: this.sessionId }
      });

      console.log('📊 Current message count for session:', messageCount);

      const sessionData = {
        sessionId: this.sessionId,
        messageCount,
        lastActivity: new Date().toISOString(),
        lastMessage: assistantResponse.substring(0, 100)
      } as any;

      if (existingSession.length > 0) {
        // Mettre à jour la session existante
        console.log('📝 Updating existing session...');
        await this.strapi.entityService.update('plugin::llm-chat.chat-session', existingSession[0].id, {
          data: sessionData
        });
        console.log('✅ Session updated');
      } else {
        // Créer une nouvelle session
        console.log('🆕 Creating new session...');
        const newSession = await this.strapi.entityService.create('plugin::llm-chat.chat-session', {
          data: {
            ...sessionData,
            title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '')
          }
        });
        console.log('✅ New session created with ID:', newSession.id);
      }

      console.timeEnd(timerId);
    } catch (error) {
      console.timeEnd(timerId);
      console.error('❌ Error updating session:', error);
    }
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
    if (config.provider === 'openai') {
      return new ChatOpenAI({
        modelName: config.openai.modelName,
        temperature: config.openai.temperature,
        openAIApiKey: config.openai.apiKey,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
      });
    } else if (config.provider === 'custom') {
      // Pour les modèles custom, on va utiliser des appels HTTP directs
      return {
        type: 'custom',
        baseUrl: config.custom.baseUrl,
        modelName: config.custom.modelName,
        temperature: config.custom.temperature,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
        apiKey: config.custom.apiKey || "not-needed",
      };
    } else {
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  };

  // Fonction pour faire des appels HTTP vers les modèles custom
  const callCustomModel = async (model: any, prompt: string) => {
    try {
      console.log('🔗 Calling custom model:', model.modelName);
      console.log('🌐 Base URL:', model.baseUrl);

      // Essayer différents endpoints selon le type de serveur
      const endpoints = [
        '/api/generate',     // Ollama
        '/v1/chat/completions', // OpenAI compatible
        '/api/chat',         // Autre format
        '/generate'          // Endpoint simple
      ];

      let lastError: Error | null = null;

      for (const endpoint of endpoints) {
        try {
          const url = `${model.baseUrl}${endpoint}`;
          console.log(`🎯 Trying endpoint: ${url}`);

          let requestBody: any;
          let headers: any = {
            'Content-Type': 'application/json',
            ...(model.apiKey !== "not-needed" ? { 'Authorization': `Bearer ${model.apiKey}` } : {})
          };

          // Format de requête selon l'endpoint
          if (endpoint === '/v1/chat/completions') {
            // Format OpenAI
            requestBody = {
              model: model.modelName,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
              think:false,
              temperature: model.temperature,
              max_tokens: model.maxTokens || 4096,
            };
          } else {
            // Format Ollama/simple
            requestBody = {
              model: model.modelName,
              prompt: prompt,
              stream: false,
              think:false,
              options: {
                temperature: model.temperature,
                num_ctx: model.maxTokens || 4096,
              }
            };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            const data = await response.json() as any;
            console.log('✅ Successful response from:', endpoint);

            // Extraire la réponse selon le format
            if (data.response) {
              return data.response; // Format Ollama
            } else if (data.choices && data.choices[0]?.message?.content) {
              return data.choices[0].message.content; // Format OpenAI
            } else if (data.content) {
              return data.content; // Format simple
            } else if (typeof data === 'string') {
              return data; // Réponse directe
            } else {
              console.log('⚠️ Unexpected response format:', data);
              return JSON.stringify(data);
            }
          } else {
            console.log(`❌ Endpoint ${endpoint} failed with status: ${response.status}`);
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (endpointError) {
          console.log(`❌ Endpoint ${endpoint} failed:`, endpointError.message);
          lastError = endpointError as Error;
        }
      }

      // Si aucun endpoint n'a fonctionné
      throw new Error(`All endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);

    } catch (error) {
      console.error('❌ Error calling custom model:', error);
      console.error('📋 Model config:', {
        baseUrl: model.baseUrl,
        modelName: model.modelName,
        hasApiKey: model.apiKey !== "not-needed"
      });
      throw error;
    }
  };

  // Fonction pour faire des appels HTTP streaming vers les modèles custom
  const streamCustomModel = async function* (model: any, prompt: string) {
    try {
      console.log('🌊 Starting streaming for custom model:', model.modelName);

      // Essayer différents endpoints pour le streaming
      const endpoints = [
        '/api/generate',     // Ollama
        '/v1/chat/completions', // OpenAI compatible
        '/api/chat',         // Autre format
        '/generate'          // Endpoint simple
      ];

      let lastError: Error | null = null;

      for (const endpoint of endpoints) {
        try {
          const url = `${model.baseUrl}${endpoint}`;
          console.log(`🎯 Trying streaming endpoint: ${url}`);

          let requestBody: any;
          let headers: any = {
            'Content-Type': 'application/json',
            ...(model.apiKey !== "not-needed" ? { 'Authorization': `Bearer ${model.apiKey}` } : {})
          };

          // Format de requête selon l'endpoint
          if (endpoint === '/v1/chat/completions') {
            // Format OpenAI
            requestBody = {
              model: model.modelName,
              messages: [{ role: 'user', content: prompt }],
              stream: true,
              think:false,
              temperature: model.temperature,
              max_tokens: model.maxTokens || 4096,
            };
          } else {
            // Format Ollama/simple
            requestBody = {
              model: model.modelName,
              prompt: prompt,
              stream: true,
              think:false,
              options: {
                temperature: model.temperature,
                num_ctx: model.maxTokens || 4096,
              }
            };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            console.log('✅ Streaming response started from:', endpoint);

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error('Response body is not readable');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.trim()) {
                    try {
                      // Gérer les formats SSE
                      const cleanLine = line.replace(/^data: /, '').trim();
                      if (cleanLine === '[DONE]') return;

                      const data = JSON.parse(cleanLine);

                      // Extraire le contenu selon le format
                      let content = '';
                      if (data.response) {
                        content = data.response; // Format Ollama
                      } else if (data.choices && data.choices[0]?.delta?.content) {
                        content = data.choices[0].delta.content; // Format OpenAI
                      } else if (data.content) {
                        content = data.content; // Format simple
                      }

                      if (content) {
                        yield content;
                      }

                      if (data.done) {
                        return;
                      }
                    } catch (parseError) {
                      console.warn('Failed to parse streaming line:', line);
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
            return; // Succès, sortir de la boucle
          } else {
            console.log(`❌ Streaming endpoint ${endpoint} failed with status: ${response.status}`);
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (endpointError) {
          console.log(`❌ Streaming endpoint ${endpoint} failed:`, endpointError.message);
          lastError = endpointError as Error;
        }
      }

      // Si aucun endpoint n'a fonctionné
      throw new Error(`All streaming endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);

    } catch (error) {
      console.error('❌ Error streaming custom model:', error);
      throw error;
    }
  };

  // Note: Les méthodes shouldUseRAG, formatChromaResults, getLanguageLevelLabel
  // et getCollectionDisplayName ont été déplacées dans SmartRAGTool
  // pour une approche plus modulaire et réutilisable

  // Méthode commune pour créer ou récupérer une conversation
  const getOrCreateConversation = async (sessionId: string, config: LlmChatConfig, options?: ConversationOptions, streaming: boolean = false) => {
    const chainTimerId = `⛓️  Chain Setup [${sessionId}]`;

    if (!conversationChains.has(sessionId)) {
      console.time(chainTimerId);
      console.log('🔗 Creating new conversation chain for session:', sessionId);

      // Créer une mémoire personnalisée utilisant Strapi
      const memory = new StrapiChatMemory(strapi, sessionId);

      // Décider si on utilise un agent avec outils RAG ou une conversation simple
      const useRAG = options?.useRAG !== false; // RAG activé par défaut

      if (useRAG) {
        if (config.provider === 'openai') {
          console.log(`🤖 Creating OpenAI agent with ChromaDB tools${streaming ? ' (streaming)' : ''}...`);

          // Créer le modèle avec streaming si nécessaire
          const model = new ChatOpenAI({
            modelName: config.openai.modelName,
            temperature: config.openai.temperature,
            openAIApiKey: config.openai.apiKey,
            maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
            streaming,
          });

          // Créer les outils ChromaDB
          const tools = [
            new SmartRAGTool(strapi), // Outil intelligent qui décide automatiquement quand utiliser RAG avec Ollama qwen3:0.6b
          ];

          const agentPrompt = ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_PROMPT],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new MessagesPlaceholder("agent_scratchpad"),
          ]);

          // Créer l'agent OpenAI Functions
          const agent = await createOpenAIFunctionsAgent({
            llm: model,
            tools,
            prompt: agentPrompt,
          });

          // Créer l'exécuteur d'agent avec mémoire personnalisée
          const agentExecutor = new AgentExecutor({
            agent,
            tools,
            memory,
            verbose: true,
            returnIntermediateSteps: false,
          });

          conversationChains.set(sessionId, { type: 'agent', executor: agentExecutor });
        } else {
          console.log(`🔧 Creating custom RAG chain with SmartRAGTool integration${streaming ? ' (streaming)' : ''}...`);

          // Pour les modèles custom (Ollama), on utilise SmartRAGTool
          const smartRAGTool = new SmartRAGTool(strapi);

          conversationChains.set(sessionId, {
            type: 'rag_smart',
            model: createModel(config, options),
            smartRAGTool,
            memory
          });
        }
      } else {
        console.log(`💬 Creating simple conversation chain${streaming ? ' (streaming)' : ''}...`);

        if (config.provider === 'openai') {
          // Créer le modèle avec streaming si nécessaire
          const model = new ChatOpenAI({
            modelName: config.openai.modelName,
            temperature: config.openai.temperature,
            openAIApiKey: config.openai.apiKey,
            maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
            streaming,
          });

          // Conversation simple sans outils
          const chatPrompt = ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_PROMPT],
            new MessagesPlaceholder("history"),
            HumanMessagePromptTemplate.fromTemplate("{input}"),
          ]);

          const chain = new ConversationChain({
            memory: memory,
            prompt: chatPrompt,
            llm: model,
          });

          conversationChains.set(sessionId, { type: 'chain', chain });
        } else {
          // Pour les modèles custom, on stocke la config et la mémoire
          conversationChains.set(sessionId, {
            type: 'custom_simple',
            model: createModel(config, options),
            memory
          });
        }
      }

      console.timeEnd(chainTimerId);
    } else {
      console.log('♻️ Using existing conversation for session:', sessionId);
    }

    return conversationChains.get(sessionId);
  };

  // Note: La fonction executeManualRAG a été remplacée par SmartRAGTool
  // qui gère automatiquement l'analyse et la recherche RAG

  // Méthode pour construire le prompt avec contexte et historique
  const buildPromptWithContext = async (memory: any, context: string, message: string, systemPrompt: string = SYSTEM_PROMPT) => {
    const memoryVariables = await memory.loadMemoryVariables({});
    const historyString = memoryVariables.history ?
      memoryVariables.history.map(msg => `${msg._getType()}: ${msg.content}`).join('\n') : '';

    if (context) {
      return `${systemPrompt}\n\n${context}\n\nConversation history:\n${historyString}\n\nQuestion: ${message}\n\nAssistant:`;
    } else {
      return `${systemPrompt}\n\nConversation history:\n${historyString}\n\nHuman: ${message}\n\nAssistant:`;
    }
  };

  return {
    // Créer une nouvelle conversation ou continuer une existante
    async chat(message: string, options?: ConversationOptions) {
      const sessionId = options?.sessionId || 'default';
      const timerId = `💬 Chat Session [${sessionId}]`;
      console.time(timerId);

      try {
        strapi.log.info('🚀 Starting chat for session:', sessionId);

        // Validation Strapi
        if (!strapi.entityService) {
          throw new Error('Strapi entity service not available');
        }

        const pluginConfig = strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default');
        const config = pluginConfig as LlmChatConfig;

        if (!config || !config.provider) {
          throw new Error('LLM provider not configured');
        }

        // S'assurer qu'une session existe AVANT de créer la chaîne
        await this.ensureSessionExists(sessionId, message);

        // Test DB rapide
        const testMessage = await strapi.entityService.create('plugin::llm-chat.chat-message', {
          data: {
            sessionId: sessionId,
            role: 'system',
            content: 'Test message',
            timestamp: new Date().toISOString()
          }
        });
        await strapi.entityService.delete('plugin::llm-chat.chat-message', testMessage.id);

        // Récupérer ou créer une conversation
        const conversationData = await getOrCreateConversation(sessionId, config, options, false);

        const llmTimerId = `🤖 LLM Call [${sessionId}]`;
        console.time(llmTimerId);

        let response;
        if (conversationData.type === 'agent') {
          // Utiliser l'agent avec outils
          response = await conversationData.executor.call({
            input: message,
          });
        } else if (conversationData.type === 'rag_smart') {
          // Utiliser SmartRAGTool pour les modèles custom
          console.log('🤖 Using SmartRAGTool for custom provider...');

          // Utiliser SmartRAGTool pour analyser le message et récupérer le contexte
          const context = await conversationData.smartRAGTool._call(message);
          const fullPrompt = await buildPromptWithContext(conversationData.memory, context, message);
          const responseText = await callCustomModel(conversationData.model, fullPrompt);

          // Sauvegarder manuellement
          await conversationData.memory.saveContext(
            { input: message },
            { response: responseText }
          );

          response = { response: responseText };
        } else if (conversationData.type === 'custom_simple') {
          // Construire le prompt manuellement pour les modèles custom
          const fullPrompt = await buildPromptWithContext(conversationData.memory, '', message);
          const responseText = await callCustomModel(conversationData.model, fullPrompt);

          // Sauvegarder manuellement
          await conversationData.memory.saveContext(
            { input: message },
            { response: responseText }
          );

          response = { response: responseText };
        } else {
          response = await conversationData.chain.call({
            input: message,
          });
        }

        console.timeEnd(llmTimerId);

        // Vérifications finales
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { sessionId },
          sort: { createdAt: 'asc' }
        });

        console.timeEnd(timerId);
        return {
          sessionId,
          response: response.response,
          history: messages,
        };
      } catch (error) {
        console.timeEnd(timerId);
        strapi.log.error('❌ Error in langchain chat service:', error);
        throw error;
      }
    },

    // S'assurer qu'une session existe
    async ensureSessionExists(sessionId: string, firstMessage: string) {
      const timerId = `🔍 Session Exists Check [${sessionId}]`;
      console.time(timerId);

      try {
        strapi.log.info('🔍 Checking if session exists:', sessionId);
        console.log('🔍 Checking if session exists:', sessionId);

        // Vérifier que le content-type existe
        try {
          const contentType = strapi.contentType('plugin::llm-chat.chat-session');
          if (!contentType) {
            throw new Error('Content type plugin::llm-chat.chat-session not found');
          }
          console.log('✅ Content type chat-session found');
        } catch (error) {
          console.error('❌ Content type chat-session not found:', error);
          throw error;
        }

        const existingSession = await strapi.entityService.findMany('plugin::llm-chat.chat-session', {
          filters: { sessionId }
        }) as any[];

        console.log('🔍 Query result:', existingSession);

        if (existingSession.length === 0) {
          strapi.log.info('🆕 Session does not exist, creating new one...');
          console.log('🆕 Session does not exist, creating new one...');

          // Créer une nouvelle session
          const newSession = await strapi.entityService.create('plugin::llm-chat.chat-session', {
            data: {
              sessionId,
              title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
              messageCount: 0,
              lastActivity: new Date().toISOString(),
              lastMessage: 'New session'
            }
          });

          strapi.log.info('✅ New session created with ID:', newSession.id);
          console.log('✅ New session created with ID:', newSession.id);
        } else {
          strapi.log.info('✅ Session already exists');
          console.log('✅ Session already exists');
        }

        console.timeEnd(timerId);
      } catch (error) {
        console.timeEnd(timerId);
        strapi.log.error('❌ Error ensuring session exists:', error);
        console.error('❌ Error ensuring session exists:', error);
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
        const config = pluginConfig as LlmChatConfig;

        if (!config || !config.provider) {
          throw new Error('LLM provider not configured');
        }

        const sessionId = options?.sessionId || 'default';

        console.log('🌊 Starting streaming chat for session:', sessionId);

        // S'assurer qu'une session existe
        await this.ensureSessionExists(sessionId, message);

        // Récupérer ou créer une conversation avec streaming activé
        const conversationData = await getOrCreateConversation(sessionId, config, options, true);

        // Retourner un générateur pour le streaming
        return {
          async *stream() {
            let fullResponse = '';

            try {
              console.log('🌊 Starting LangChain streaming...');

              if (conversationData.type === 'agent') {
                // Streaming avec agent OpenAI et outils
                const result = await conversationData.executor.call({
                  input: message,
                }, {
                  callbacks: [{
                    handleLLMNewToken(token: string) {
                      fullResponse += token;
                      return `data: ${JSON.stringify({ type: 'chunk', content: token })}\n\n`;
                    }
                  }]
                });

                if (!fullResponse && result.output) {
                  fullResponse = result.output;
                  yield `data: ${JSON.stringify({ type: 'chunk', content: result.output })}\n\n`;
                }
              } else if (conversationData.type === 'rag_smart') {
                // Streaming avec SmartRAGTool pour les modèles custom
                console.log('🤖 Using SmartRAGTool for streaming...');
                const context = await conversationData.smartRAGTool._call(message);
                const fullPrompt = await buildPromptWithContext(conversationData.memory, context, message);

                // Stream depuis le modèle custom
                const stream = streamCustomModel(conversationData.model, fullPrompt);
                for await (const chunk of stream) {
                  if (chunk) {
                    fullResponse += chunk;
                    yield `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
                  }
                }
              } else if (conversationData.type === 'custom_simple') {
                // Streaming simple pour les modèles custom
                const fullPrompt = await buildPromptWithContext(conversationData.memory, '', message);

                // Stream depuis le modèle custom
                const stream = streamCustomModel(conversationData.model, fullPrompt);
                for await (const chunk of stream) {
                  if (chunk) {
                    fullResponse += chunk;
                    yield `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
                  }
                }
              } else {
                // Streaming simple sans outils (OpenAI)
                const llm = conversationData.chain.llm;
                const fullPrompt = await buildPromptWithContext(conversationData.chain.memory, '', message, SYSTEM_PROMPT);

                const stream = await llm.stream(fullPrompt);
                for await (const chunk of stream) {
                  let content = '';
                  if (chunk.content) {
                    content = chunk.content;
                  } else if (typeof chunk === 'string') {
                    content = chunk;
                  }

                  if (content) {
                    fullResponse += content;
                    yield `data: ${JSON.stringify({ type: 'chunk', content: content })}\n\n`;
                  }
                }
              }

              // Sauvegarder la conversation après le streaming
              let memory;
              if (conversationData.type === 'rag_smart' || conversationData.type === 'custom_simple') {
                memory = conversationData.memory;
              } else {
                memory = new StrapiChatMemory(strapi, sessionId);
              }

              await memory.saveContext(
                { input: message },
                { response: fullResponse }
              );

              yield `data: ${JSON.stringify({ type: 'complete' })}\n\n`;
            } catch (error) {
              console.error('❌ Streaming error:', error);
              yield `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`;
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
