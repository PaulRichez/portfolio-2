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
import { ChromaRetrievalTool, ChromaAdvancedRetrievalTool } from "../tools/chroma-retrieval-tool";
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
    strapi.log.info('💾 Saving context for session:', this.sessionId);
    console.log('User message:', input.substring(0, 50) + '...');
    console.log('Assistant response:', output.substring(0, 50) + '...');

    try {
      // Vérifier que le content-type existe
      const messageContentType = strapi.contentType('plugin::llm-chat.chat-message');
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
      strapi.log.info('✅ User message saved with ID:', userMessage.id);
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
      strapi.log.info('✅ Assistant message saved with ID:', assistantMessage.id);
      console.log('✅ Assistant message saved with ID:', assistantMessage.id);

      // Créer ou mettre à jour la session
      await this.updateOrCreateSession(input, output);

      console.timeEnd(timerId);
    } catch (error) {
      console.timeEnd(timerId);
      strapi.log.error('❌ Error saving messages:', error);
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

  // Valeurs système codées en dur
  const SYSTEM_TEMPERATURE = 0.7;

  // Créer un modèle en fonction de la configuration
  const createModel = (config: LlmChatConfig, options?: ConversationOptions) => {
    if (config.provider === 'openai') {
      return new ChatOpenAI({
        modelName: config.openai.modelName,
        temperature: SYSTEM_TEMPERATURE,
        openAIApiKey: config.openai.apiKey,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
      });
    } else if (config.provider === 'custom') {
      return new ChatOpenAI({
        modelName: config.custom.modelName,
        temperature: SYSTEM_TEMPERATURE,
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

  // Méthodes utilitaires pour le RAG manuel
  const shouldUseRAG = (message: string): boolean => {
    const portfolioKeywords = [
      'projet', 'projects', 'compétence', 'skills', 'expérience', 'experience',
      'formation', 'education', 'contact', 'réalisation', 'portfolio',
      'technologie', 'technology', 'développement', 'development',
      'react', 'vue', 'angular', 'nodejs', 'php', 'python', 'javascript',
      'typescript', 'html', 'css', 'bootstrap', 'tailwind',
      'qui es-tu', 'présente', 'cv', 'profil', 'about', 'à propos',
      'github', 'linkedin', 'email', 'téléphone', 'coordonnées',
      'web', 'mobile', 'frontend', 'backend', 'fullstack', 'toi', 'paul'
    ];

    const lowerMessage = message.toLowerCase();
    return portfolioKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  const formatChromaResults = (results: any[], originalQuery: string): string => {
    if (!results || results.length === 0) {
      return '';
    }

    const sections: string[] = [];

    sections.push(`=== Informations contextuelles pour "${originalQuery}" ===\n`);

    results.forEach((result, index) => {
      const metadata = result.metadata || {};
      const collection = metadata.collection || 'unknown';
      const similarity = (1 - result.distance).toFixed(3); // Convertir distance en similarité

      sections.push(`${index + 1}. ${getCollectionDisplayName(collection)} (Pertinence: ${similarity})`);
      sections.push(`   ${result.document.trim()}`);

      // Ajouter des métadonnées pertinentes
      if (metadata.github_link) {
        sections.push(`   🔗 GitHub: ${metadata.github_link}`);
      }
      if (metadata.link_demo) {
        sections.push(`   🌐 Démo: ${metadata.link_demo}`);
      }
      if (metadata.link_npm) {
        sections.push(`   📦 NPM: ${metadata.link_npm}`);
      }
      if (metadata.email) {
        sections.push(`   📧 Email: ${metadata.email}`);
      }
      if (metadata.linkedin) {
        sections.push(`   💼 LinkedIn: ${metadata.linkedin}`);
      }
      if (metadata.website) {
        sections.push(`   🌐 Site web: ${metadata.website}`);
      }
      if (metadata.github) {
        sections.push(`   🔗 GitHub: ${metadata.github}`);
      }
      if (metadata.phoneNumber) {
        sections.push(`   📞 Téléphone: ${metadata.phoneNumber}`);
      }
      if (metadata.codings_names) {
        sections.push(`   💻 Technologies: ${metadata.codings_names}`);
      }
      if (metadata.coding_skills_names) {
        sections.push(`   🎯 Compétences: ${metadata.coding_skills_names}`);
      }
      if (metadata.category) {
        sections.push(`   📁 Catégorie: ${metadata.category}`);
      }
      if (metadata.languages) {
        const languageLabels = metadata.languages.split(', ').map(lang => {
          const match = lang.match(/(.*)\s\((\d+)%\)/);
          if (match) {
            const [, name, percentage] = match;
            const label = getLanguageLevelLabel(parseInt(percentage));
            return `${name} (${label})`;
          }
          return lang;
        }).join(', ');
        sections.push(`   🌐 Langues: ${languageLabels}`);
      }

      sections.push(''); // Ligne vide entre les résultats
    });

    sections.push(`=== Fin des informations contextuelles (${results.length} résultat${results.length > 1 ? 's' : ''}) ===\n`);

    return sections.join('\n');
  };

  const getLanguageLevelLabel = (percentage: number): string => {
    if (percentage >= 95) return 'Langue maternelle';
    if (percentage >= 85) return 'Courant';
    if (percentage >= 70) return 'Avancé';
    if (percentage >= 50) return 'Intermédiaire';
    if (percentage >= 30) return 'Débutant';
    return 'Notions';
  };

  const getCollectionDisplayName = (collection: string): string => {
    const displayNames: Record<string, string> = {
      'api::project.project': '📁 Projet',
      'api::me.me': '👤 Profil personnel',
      'api::article.article': '📝 Article',
      'api::faq.faq': '❓ FAQ'
    };

    return displayNames[collection] || `📄 ${collection}`;
  };

  return {
    // Créer une nouvelle conversation ou continuer une existante
    async chat(message: string, options?: ConversationOptions) {
      const sessionId = options?.sessionId || 'default';
      const timerId = `💬 Chat Session [${sessionId}]`;
      console.time(timerId);

      try {
        strapi.log.info('🚀 Starting chat for session:', sessionId);
        console.log('📝 User message:', message.substring(0, 50) + '...');

        // Vérifier que Strapi est correctement initialisé
        if (!strapi.entityService) {
          throw new Error('Strapi entity service not available');
        }

        const pluginConfig = strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default');

        if (!pluginConfig) {
          throw new Error('LLM Chat plugin configuration not found');
        }

        const config = pluginConfig as LlmChatConfig;

        if (!config.provider) {
          throw new Error('LLM provider not configured');
        }

        const model = createModel(config, options);

        // S'assurer qu'une session existe AVANT de créer la chaîne
        const ensureTimerId = `🔍 Session Check [${sessionId}]`;
        console.time(ensureTimerId);
        await this.ensureSessionExists(sessionId, message);
        console.timeEnd(ensureTimerId);

        // Test: créer un message directement pour voir si ça fonctionne
        const testTimerId = `🧪 DB Test [${sessionId}]`;
        console.time(testTimerId);
        try {
          const testMessage = await strapi.entityService.create('plugin::llm-chat.chat-message', {
            data: {
              sessionId: sessionId,
              role: 'system',
              content: 'Test message',
              timestamp: new Date().toISOString()
            }
          });
          console.log('✅ Test message created successfully:', testMessage.id);

          // Supprimer le message de test
          await strapi.entityService.delete('plugin::llm-chat.chat-message', testMessage.id);
          console.log('✅ Test message deleted');
          console.timeEnd(testTimerId);
        } catch (testError) {
          console.timeEnd(testTimerId);
          console.error('❌ Failed to create test message:', testError);
          throw new Error('Database connection or content-type issue: ' + testError.message);
        }        // Récupérer ou créer une conversation
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
              console.log('🤖 Creating OpenAI agent with ChromaDB tools...');

              // Créer les outils ChromaDB
              const tools = [
                new ChromaRetrievalTool(strapi),
                new ChromaAdvancedRetrievalTool(strapi)
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
              console.log('🔧 Creating custom RAG chain with manual tool integration...');

              // Pour les modèles custom (Ollama), on utilise une approche RAG manuelle
              const chromaService = strapi.plugin('llm-chat').service('chromaVectorService');

              const chatPrompt = ChatPromptTemplate.fromMessages([
                ["system", SYSTEM_PROMPT],
                new MessagesPlaceholder("history"),
                HumanMessagePromptTemplate.fromTemplate("{context}\n\nQuestion: {input}"),
              ]);

              const chain = new ConversationChain({
                memory: memory,
                prompt: chatPrompt,
                llm: model,
              });

              conversationChains.set(sessionId, {
                type: 'rag_manual',
                chain,
                chromaService
              });
            }
          } else {
            console.log('💬 Creating simple conversation chain...');

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
          }

          console.timeEnd(chainTimerId);
        } else {
          console.log('♻️ Using existing conversation for session:', sessionId);
        }

        // Récupérer la conversation existante
        const conversationData = conversationChains.get(sessionId);

        const llmTimerId = `🤖 LLM Call [${sessionId}]`;
        console.time(llmTimerId);

        let response;
        if (conversationData.type === 'agent') {
          // Utiliser l'agent avec outils
          response = await conversationData.executor.call({
            input: message,
          });
        } else if (conversationData.type === 'rag_manual') {
          // Utiliser RAG manuel pour les modèles custom
          console.log('🔍 Using manual RAG for custom provider...');

          // Fonction pour détecter si on a besoin de rechercher dans ChromaDB
          const needsRAG = shouldUseRAG(message);

          let context = '';
          if (needsRAG) {
            const ragTimerId = `🔍 RAG Search [${sessionId}]`;
            console.time(ragTimerId);
            console.log('🕵️ Searching ChromaDB for relevant information...');
            try {
              const searchResults = await conversationData.chromaService.searchDocuments(message, 5);
              if (searchResults && searchResults.length > 0) {
                context = formatChromaResults(searchResults, message);
                console.log(`✅ Found ${searchResults.length} relevant documents`);
              } else {
                console.log('ℹ️ No relevant documents found in ChromaDB');
              }
              console.timeEnd(ragTimerId);
            } catch (searchError) {
              console.timeEnd(ragTimerId);
              console.error('❌ Error searching ChromaDB:', searchError);
            }
          } else {
            console.log('ℹ️ Question does not require ChromaDB search');
          }

          // Appeler la chaîne avec le contexte
          response = await conversationData.chain.call({
            input: message,
            context: context
          });
        } else {
          // Utiliser la chaîne simple
          response = await conversationData.chain.call({
            input: message,
          });
        }

        console.timeEnd(llmTimerId);
        console.log('✅ LLM response received');

        // Vérifier que les messages ont bien été sauvegardés
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { sessionId },
          sort: { createdAt: 'asc' }
        });

        console.log('📚 Total messages in database for session:', messages.length);

        // Vérifier que la session existe
        const sessions = await strapi.entityService.findMany('plugin::llm-chat.chat-session', {
          filters: { sessionId }
        });

        console.log('🗂️ Sessions found:', sessions.length);

        console.timeEnd(timerId);
        return {
          sessionId,
          response: response.response,
          history: messages,
        };
      } catch (error) {
        console.timeEnd(timerId);
        strapi.log.error('❌ Error in langchain chat service:', error);
        console.error('❌ Error in langchain chat service:', error);
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

        if (!pluginConfig) {
          throw new Error('LLM Chat plugin configuration not found');
        }

        const config = pluginConfig as LlmChatConfig;
        const sessionId = options?.sessionId || 'default';

        // Créer le modèle avec streaming activé
        let model;
        if (config.provider === 'openai') {
          model = new ChatOpenAI({
            modelName: config.openai.modelName,
            temperature: SYSTEM_TEMPERATURE,
            openAIApiKey: config.openai.apiKey,
            maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
            streaming: true,
          });
        } else if (config.provider === 'custom') {
          model = new ChatOpenAI({
            modelName: config.custom.modelName,
            temperature: SYSTEM_TEMPERATURE,
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

          conversationChains.set(sessionId, chain);
        }

        const chain = conversationChains.get(sessionId);

        // Retourner un générateur pour le streaming
        return {
          async *stream() {
            let fullResponse = '';

            try {
              console.log('🌊 Starting LangChain streaming...');

              // Utiliser le modèle directement avec streaming
              const stream = await model.stream(message, {
                callbacks: [{
                  handleLLMNewToken(token) {
                    console.log('📝 Token received:', token);
                    fullResponse += token;
                  }
                }]
              });

              for await (const chunk of stream) {
                console.log('📦 Chunk received:', chunk);

                // Les chunks de LangChain contiennent le contenu dans .content
                let content = '';
                if (chunk.content) {
                  content = chunk.content;
                } else if (typeof chunk === 'string') {
                  content = chunk;
                } else if (chunk.text) {
                  content = chunk.text;
                }

                if (content) {
                  // Filtrer les balises <think> si présentes
                  const filteredContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

                  if (filteredContent) {
                    fullResponse += filteredContent;
                    yield `data: ${JSON.stringify({ content: filteredContent })}\n\n`;
                  }
                }
              }

              console.log('✅ Streaming completed, full response:', fullResponse.substring(0, 100) + '...');

              // Sauvegarder la conversation après le streaming
              const memory = new StrapiChatMemory(strapi, sessionId);
              await memory.saveContext(
                { input: message },
                { response: fullResponse }
              );

              yield `data: [DONE]\n\n`;
            } catch (error) {
              console.error('❌ Streaming error:', error);
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
