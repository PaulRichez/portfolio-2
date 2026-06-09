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
import { SuggestionsService } from "./suggestions-service";

// Interface pour définir la structure de la configuration
export interface LlmChatConfig {
  provider: 'zhipu' | 'ollama' | 'custom';
  providerOrder?: string[];
  zhipu: {
    apiKey: string;
    modelName: string; // 'glm-4-flash'
  };
  ollama: {
    baseUrl: string;
    modelName: string;
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
    // Fallback to global strapi if injected one is undefined (sometimes happens in v4 services depending on call context)
    this.strapi = strapi || (global as any).strapi;
    this.sessionId = sessionId;
    if (!this.strapi) {
      console.error('❌ FATAL: Strapi instance is undefined in StrapiChatMemory constructor!');
    }
  }

  get memoryKeys() {
    return ["history"];
  }

  async loadMemoryVariables() {
    const messages = await this.getChatMessages();
    return { history: messages };
  }

  async saveContext(inputValues: Record<string, any>, outputValues: Record<string, any>) {
    const input = (inputValues[this.inputKey] || '') as string;
    const output = (outputValues[this.outputKey] || '') as string;
    const provider = outputValues.provider || 'unknown'; // Extract provider from outputValues

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

      // Retrieve the actual session Entity ID to verify relation
      const sessions = await this.strapi.entityService.findMany('plugin::llm-chat.chat-session', {
        filters: { sessionId: this.sessionId }
      }) as any[];
      const sessionRelation = sessions.length > 0 ? sessions[0].id : null;

      // Sauvegarder le message utilisateur
      const userMessage = await this.strapi.entityService.create('plugin::llm-chat.chat-message', {
        data: {
          session: sessionRelation, // Link relation
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
          session: sessionRelation, // Link relation
          role: 'assistant',
          content: output,
          provider: provider, // Save provider
          debugResponse: outputValues.fullData || null, // Save full JSON response
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
        filters: { session: { sessionId: this.sessionId } }
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
    console.log(`📜 fetching history for session: ${this.sessionId}`); // DEBUG
    try {
      const messages = await this.strapi.entityService.findMany('plugin::llm-chat.chat-message', {
        filters: { session: { sessionId: this.sessionId } },
        sort: { createdAt: 'asc' }
      });
      console.log(`📜 found ${messages.length} messages in history`); // DEBUG

      return messages.map((msg: any) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });
    } catch (err) {
      console.error('❌ Error fetching chat messages:', err);
      return [];
    }
  }


  async clear() {
    const messages = await this.strapi.entityService.findMany('plugin::llm-chat.chat-message', {
      filters: { session: { sessionId: this.sessionId } }
    }) as any[];

    for (const message of messages) {
      await this.strapi.entityService.delete('plugin::llm-chat.chat-message', message.id);
    }
  }
}

const langchainService = ({ strapi }: { strapi: Core.Strapi }) => {
  // Stocker les chaînes de conversation en cache
  const conversationChains = new Map();

  // Helper to get config from store (dynamic) to support runtime updates
  const getConfig = async (): Promise<LlmChatConfig> => {
    const pluginStore = strapi.store({
      environment: '',
      type: 'plugin',
      name: 'llm-chat',
      key: 'config',
    });

    const storedConfig = await pluginStore.get();
    const fileConfig = (strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default')) as LlmChatConfig;

    return {
      ...fileConfig,
      ...(storedConfig as object)
    };
  };

  // Configuration Zhipu AI (OpenAI Compatible)
  const createZhipuConfig = (config: LlmChatConfig) => {
    return {
      apiKey: config.zhipu.apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
      model: config.zhipu.modelName || 'glm-4-flash',
    };
  };

  // Créer un modèle en fonction de la configuration
  const createModel = (config: LlmChatConfig, options?: ConversationOptions) => {
    if (config.provider === 'zhipu') {
      const zhipuConfig = createZhipuConfig(config);
      // Return config object for streamCustomModel instead of ChatOpenAI instance
      // This allows uniform handling in rag_smart flow
      return {
        type: 'custom', // Treated as custom OpenAI-compatible
        baseUrl: zhipuConfig.baseURL.replace(/\/$/, ''), // Ensure no trailing slash
        modelName: zhipuConfig.model,
        apiKey: zhipuConfig.apiKey,
        temperature: 0.7,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
      };
    } else if (config.provider === 'custom' || config.provider === 'ollama') {
      const baseUrl = config.provider === 'ollama' ? (config.ollama.baseUrl || process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:11434') : config.custom.baseUrl;
      const modelName = config.provider === 'ollama' ? (config.ollama.modelName || 'llama3') : config.custom.modelName;

      return {
        type: 'custom',
        baseUrl: baseUrl.replace(/\/$/, ''),
        modelName: modelName,
        temperature: 0.7,
        maxTokens: options?.maxTokens ? Number(options.maxTokens) : undefined,
        apiKey: config.provider === 'custom' ? config.custom.apiKey : "not-needed",
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
        '/chat/completions',    // OpenAI compatible (Zhipu/Others)
        '/v1/chat/completions', // OpenAI compatible (Standard)
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
          if (endpoint === '/v1/chat/completions' || endpoint === '/chat/completions') {
            // Format OpenAI
            requestBody = {
              model: model.modelName,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
              think: false,
              temperature: model.temperature,
              max_tokens: model.maxTokens || 4096,
            };
          } else {
            // Format Ollama/simple
            requestBody = {
              model: model.modelName,
              prompt: prompt,
              stream: false,
              think: false,
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
        '/chat/completions',    // OpenAI compatible (Zhipu/Others)
        '/v1/chat/completions', // OpenAI compatible (Standard)
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
          if (endpoint === '/v1/chat/completions' || endpoint === '/chat/completions') {
            // Format OpenAI
            requestBody = {
              model: model.modelName,
              messages: [{ role: 'user', content: prompt }],
              stream: true,
              think: false,
              temperature: model.temperature,
              max_tokens: model.maxTokens || 4096,
            };
          } else {
            // Format Ollama/simple
            requestBody = {
              model: model.modelName,
              prompt: prompt,
              stream: true,
              think: false,
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
    // Unique key per session AND provider to avoid reusing wrong chain during failover
    const cacheKey = `${sessionId}:${config.provider}`;
    const chainTimerId = `⛓️  Chain Setup [${cacheKey}]`;

    if (!conversationChains.has(cacheKey)) {
      console.time(chainTimerId);
      console.log('🔗 Creating new conversation chain for:', cacheKey);

      // Créer une mémoire personnalisée utilisant Strapi
      const memory = new StrapiChatMemory(strapi, sessionId);

      // Décider si on utilise un agent avec outils RAG ou une conversation simple
      const useRAG = false; // RAG désactivé : le CV complet est injecté dans le prompt (buildPromptWithContext)

      if (useRAG) {
        // UNIFIED PATH: All providers use SmartRAGTool manually (rag_smart)
        // This ensures consistent prompt construction and reliable streaming
        console.log(`🔧 Creating PaulIA RAG chain with SmartRAGTool integration${streaming ? ' (streaming)' : ''}...`);

        // Pour les modèles custom (Ollama) ET Zhipu, on utilise SmartRAGTool
        const smartRAGTool = new SmartRAGTool(strapi);

        conversationChains.set(cacheKey, {
          type: 'rag_smart',
          model: createModel(config, options),
          smartRAGTool,
          memory
        });

      } else {
        console.log(`💬 Creating PaulIA simple conversation chain${streaming ? ' (streaming)' : ''}...`);

        // For non-RAG simple chat, we also use 'custom_simple' for consistency now
        conversationChains.set(cacheKey, {
          type: 'custom_simple',
          model: createModel(config, options),
          memory
        });
      }

      console.timeEnd(chainTimerId);
    } else {
      console.log('♻️ Using existing PaulIA conversation for:', cacheKey);
    }

    return conversationChains.get(cacheKey);
  };

  // Note: La fonction executeManualRAG a été remplacée par SmartRAGTool
  // qui gère automatiquement l'analyse et la recherche RAG

  // Construit un bloc texte compact du CV (profil + projets + parcours) injecté dans le prompt.
  // Remplace tout le pipeline RAG : le corpus est minuscule et tient largement dans la fenêtre
  // de contexte. Le numéro de téléphone est volontairement exclu (vie privée).
  const buildCvContext = async (): Promise<string> => {
    try {
      const me: any = await strapi.entityService.findMany('api::me.me', {
        populate: {
          experiences: true,
          diplomas: true,
          languages: true,
          coding_skills: { populate: { coding: true } },
        },
      });
      const projects: any[] = (await strapi.entityService.findMany('api::project.project', {
        populate: { codings: true },
        sort: { ranking: 'asc' },
      })) as any[];

      const lines: string[] = [];

      if (me) {
        lines.push('# PROFIL');
        const fullName = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim();
        if (fullName) lines.push(`Nom: ${fullName}`);
        if (me.postName) lines.push(`Poste: ${me.postName}`);
        if (me.city) lines.push(`Ville: ${me.city}`);
        if (me.email) lines.push(`Email: ${me.email}`);
        if (me.website) lines.push(`Site: ${me.website}`);
        if (me.github) lines.push(`GitHub: ${me.github}`);
        if (me.linkedin) lines.push(`LinkedIn: ${me.linkedin}`);
        // NOTE: phoneNumber volontairement NON inclus (vie privée).

        if (Array.isArray(me.languages) && me.languages.length) {
          lines.push(`Langues: ${me.languages.map((l: any) => `${l.name} (${l.value}%)`).join(', ')}`);
        }
        if (Array.isArray(me.coding_skills) && me.coding_skills.length) {
          const skills = me.coding_skills
            .map((s: any) => {
              const n = s.coding?.name ?? '';
              return n && s.level ? `${n} (${s.level})` : n;
            })
            .filter(Boolean)
            .join(', ');
          if (skills) lines.push(`Compétences: ${skills}`);
        }

        if (Array.isArray(me.experiences) && me.experiences.length) {
          lines.push('\n# EXPÉRIENCES');
          me.experiences.forEach((e: any) => {
            const period = `${e.startDate ?? ''}${e.endDate ? ' → ' + e.endDate : ' → en cours'}`;
            lines.push(`- ${e.title ?? ''} @ ${e.business ?? ''} (${period})`);
            if (e.descriptions) {
              const d = Array.isArray(e.descriptions) ? e.descriptions.join(' ') : String(e.descriptions);
              if (d && d.trim() && d !== '[object Object]') lines.push(`  ${d.trim()}`);
            }
          });
        }

        if (Array.isArray(me.diplomas) && me.diplomas.length) {
          lines.push('\n# FORMATION');
          me.diplomas.forEach((d: any) => {
            const period = `${d.startDate ?? ''}${d.endDate ? ' → ' + d.endDate : ''}`;
            lines.push(`- ${d.title ?? ''} (${period})${d.description ? ' — ' + d.description : ''}`);
          });
        }
      }

      if (projects && projects.length) {
        lines.push('\n# PROJETS');
        projects.forEach((p: any) => {
          const techs = Array.isArray(p.codings) ? p.codings.map((c: any) => c.name).filter(Boolean).join(', ') : '';
          const rank = p.ranking != null ? ` [priorité ${p.ranking}]` : '';
          lines.push(`- ${p.title ?? ''}${rank}${techs ? ' — Techs: ' + techs : ''}`);
          if (p.description) {
            const desc = String(p.description).replace(/\s+/g, ' ').trim();
            if (desc) lines.push(`  ${desc.slice(0, 400)}`);
          }
          const links = [
            p.link_demo && `Démo: ${p.link_demo}`,
            p.github_link && `Code: ${p.github_link}`,
            p.link_npm && `NPM: ${p.link_npm}`,
          ]
            .filter(Boolean)
            .join(' | ');
          if (links) lines.push(`  ${links}`);
        });
      }

      return lines.join('\n');
    } catch (error) {
      strapi.log.error('❌ buildCvContext error:', error);
      return '';
    }
  };

  // Méthode pour construire le prompt avec le CV injecté + l'historique
  const buildPromptWithContext = async (memory: any, context: string, message: string, systemPrompt: string = SYSTEM_PROMPT) => {
    const cv = await buildCvContext();
    const memoryVariables = await memory.loadMemoryVariables({});
    const historyString = memoryVariables.history ?
      memoryVariables.history.map(msg => {
        const role = msg._getType() === 'human' ? 'User' : 'Paul';
        return `${role}: ${msg.content}`;
      }).join('\n') : '';

    const separator = "--------------------------------------------------";

    // `context` (ancien RAG) est normalement vide désormais ; conservé par compat.
    const contextBlock = [cv, context].filter(Boolean).join('\n\n');

    return `${systemPrompt}\n\n${separator}\nCONTEXTE (mes vraies infos — profil, projets, parcours, compétences) :\n${contextBlock}\n${separator}\n\nHISTORIQUE:\n${historyString}\n\nUser: ${message}\n\nPaul:`;
  };

  return {
    // Créer une nouvelle conversation ou continuer une existante
    // Nouvelle méthode de chat avec Failover (Zhipu -> Ollama)
    async chat(message: string, options?: ConversationOptions) {
      const sessionId = options?.sessionId || 'default';
      const timerId = `💬 PaulIA Chat Session [${sessionId}]`;
      console.time(timerId);

      try {
        strapi.log.info('🚀 Starting PaulIA chat for session:', sessionId);

        if (!strapi.entityService) throw new Error('Strapi entity service not available');

        // Charger configuration dynamiquement
        const config = await getConfig();

        // S'assurer qu'une session existe
        await this.ensureSessionExists(sessionId, message);

        // Récupérer la mémoire (historique)
        const memory = new StrapiChatMemory(strapi, sessionId);

        // Charge provider order from config or fallback
        const providerOrder = config.providerOrder && config.providerOrder.length > 0
          ? config.providerOrder
          : ['zhipu', 'ollama', 'custom']; // Default order including custom if defined

        console.log('🔄 Provider failover order:', providerOrder);

        let lastError: Error | null = null;

        // Iterate through providers until one succeeds
        for (const provider of providerOrder) {
          try {
            // Skip if provider is not configured properly (basic check)
            if (provider === 'zhipu' && !config.zhipu.apiKey) continue;

            console.log(`🌟 Trying provider: ${provider}...`);

            // Create model based on current provider in loop
            // We reuse the existing createModel but need to trick it or adapt it 
            // since it takes the whole config object usually. 
            // Actually createModel uses config.provider. Let's create a temporary config object for this attempt.
            const tempConfig = { ...config, provider: provider as any };

            if (provider === 'zhipu') {
              const zhipuConfig = createZhipuConfig(config);
              const model = new ChatOpenAI({
                modelName: zhipuConfig.model,
                openAIApiKey: zhipuConfig.apiKey,
                configuration: {
                  baseURL: zhipuConfig.baseURL,
                },
                temperature: 0.7,
                maxTokens: 4096,
              });

              const fullPrompt = await buildPromptWithContext(memory, '', message);
              const response = await model.invoke([new HumanMessage(fullPrompt)]);
              const responseText = response.content as string;

              await memory.saveContext({ input: message }, { response: responseText });
              console.timeEnd(timerId);

              return {
                sessionId,
                response: responseText,
                history: await memory.getChatMessages(),
                provider: 'zhipu'
              };
            } else if (provider === 'ollama' || provider === 'custom') {
              const modelConfig = provider === 'ollama' ? {
                baseUrl: config.ollama?.baseUrl || process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:11434',
                modelName: config.ollama?.modelName || 'qwen3:0.6b',
                apiKey: 'not-needed',
                temperature: 0.7
              } : {
                baseUrl: config.custom?.baseUrl,
                modelName: config.custom?.modelName,
                apiKey: config.custom?.apiKey,
                temperature: config.custom?.temperature || 0.7
              };

              const fullPrompt = await buildPromptWithContext(memory, '', message);
              const responseText = await callCustomModel(modelConfig, fullPrompt);

              await memory.saveContext({ input: message }, { response: responseText });
              console.timeEnd(timerId);

              return {
                sessionId,
                response: responseText,
                history: await memory.getChatMessages(),
                provider: provider
              };
            }
          } catch (err) {
            console.warn(`⚠️ Provider ${provider} failed:`, err);
            lastError = err;
            // Continue to next provider
          }
        }

        // If we reach here, all providers failed
        throw lastError || new Error('All configured providers failed.');

      } catch (error) {
        console.timeEnd(timerId);
        strapi.log.error('❌ Error in PaulIA chat service:', error);
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
          filters: { session: { sessionId } },
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
        console.log('🌊 Starting PaulIA streaming chat for session:', sessionId);

        // S'assurer qu'une session existe
        await this.ensureSessionExists(sessionId, message);

        // Gestion du failover pour le streaming
        const providerOrder = config.providerOrder && config.providerOrder.length > 0
          ? config.providerOrder
          : ['zhipu', 'ollama', 'custom'];

        console.log('🔄 Streaming Provider failover order:', providerOrder);

        // Retourner un générateur pour le streaming qui gère le failover interne
        return {
          async *stream() {
            let lastError: Error | null = null;
            let success = false;
            let fullResponse = '';

            for (const provider of providerOrder) {
              if (success) break;

              try {
                // Skip if not configured
                if (provider === 'zhipu' && !config.zhipu.apiKey) continue;

                console.log(`🌊 Trying streaming provider: ${provider}...`);

                // Create temporary config for this attempt
                const tempConfig = { ...config, provider: provider as any };

                // Récupérer ou créer une conversation avec streaming activé pour ce provider
                // Note: getOrCreateConversation uses config.provider, so we must be careful.
                // Actually getOrCreateConversation respects the config passed to it.
                const conversationData = await getOrCreateConversation(sessionId, tempConfig, options, true);

                console.log('🌊 Starting PaulIA LangChain streaming...');

                let capturedPrompt = '';

                if (conversationData.type === 'agent') {
                  capturedPrompt = `Agent execution with input: ${message}`;
                  // Streaming avec PaulIA agent OpenAI et outils
                  const result = await conversationData.executor.call({
                    input: message,
                  }, {
                    callbacks: [{
                      handleLLMNewToken(token: string) {
                        fullResponse += token;
                        // Cannot yield from callback, see comments in original code
                      }
                    }]
                  });

                  // Fallback for Agent if it doesn't stream well: just yield the final result
                  if (result.output) {
                    fullResponse = result.output;
                    yield `data: ${JSON.stringify({ type: 'chunk', content: result.output })}\n\n`;
                    success = true;
                  }

                } else if (conversationData.type === 'rag_smart') {
                  // Streaming avec SmartRAGTool
                  console.log('🤖 PaulIA using SmartRAGTool for streaming...');

                  yield `data: ${JSON.stringify({ type: 'status', message: 'Analyse et recherche...' })}\n\n`;

                  // Note: SmartRAGTool fait l'analyse ET la recherche (si nécessaire)
                  const context = await conversationData.smartRAGTool._call(message);

                  yield `data: ${JSON.stringify({ type: 'status', message: 'Lecture du contexte...' })}\n\n`;

                  const fullPrompt = await buildPromptWithContext(conversationData.memory, context, message);
                  capturedPrompt = fullPrompt;

                  yield `data: ${JSON.stringify({ type: 'status', message: 'Génération de la réponse...' })}\n\n`;

                  const stream = streamCustomModel(conversationData.model, fullPrompt);

                  for await (const chunk of stream) {
                    if (chunk) {
                      fullResponse += chunk;
                      yield `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
                    }
                  }
                  if (fullResponse && fullResponse.length > 0) {
                    success = true;
                  } else {
                    console.warn(`⚠️ Provider ${provider} (rag_smart) returned empty response`);
                  }

                } else if (conversationData.type === 'custom_simple') {
                  // Streaming simple custom
                  yield `data: ${JSON.stringify({ type: 'status', message: 'Lecture de l\'historique...' })}\n\n`;

                  const fullPrompt = await buildPromptWithContext(conversationData.memory, '', message);
                  capturedPrompt = fullPrompt;

                  yield `data: ${JSON.stringify({ type: 'status', message: 'Génération de la réponse...' })}\n\n`;

                  const stream = streamCustomModel(conversationData.model, fullPrompt);

                  for await (const chunk of stream) {
                    if (chunk) {
                      fullResponse += chunk;
                      yield `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
                    }
                  }
                  if (fullResponse && fullResponse.length > 0) {
                    success = true;
                  } else {
                    console.warn(`⚠️ Provider ${provider} (custom_simple) returned empty response`);
                  }

                } else {
                  // Streaming simple OpenAI (Zhipu Direct)
                  yield `data: ${JSON.stringify({ type: 'status', message: 'Génération de la réponse...' })}\n\n`;

                  const llm = conversationData.chain.llm;
                  const fullPrompt = await buildPromptWithContext(conversationData.chain.memory, '', message, SYSTEM_PROMPT);
                  capturedPrompt = fullPrompt;

                  const stream = await llm.stream(fullPrompt);

                  for await (const chunk of stream) {
                    let content = '';
                    if (chunk.content) content = chunk.content as string;
                    else if (typeof chunk === 'string') content = chunk;

                    if (content) {
                      fullResponse += content;
                      yield `data: ${JSON.stringify({ type: 'chunk', content: content })}\n\n`;
                    }
                  }

                  // Only mark as success if we actually got some response
                  if (fullResponse && fullResponse.length > 0) {
                    success = true;
                  } else {
                    console.warn(`⚠️ Provider ${provider} returned empty response`);
                  }
                }

                if (success) {
                  // Save context only on success
                  let memory;
                  if (conversationData.type === 'rag_smart' || conversationData.type === 'custom_simple') {
                    memory = conversationData.memory;
                  } else {
                    memory = new StrapiChatMemory(strapi, sessionId);
                  }

                  // Pass provider check and full details to saveContext
                  // We pass fullResponse AND provider. the 'response' key is used for the message content.
                  await memory.saveContext(
                    { input: message },
                    {
                      response: fullResponse,
                      provider: provider,
                      fullData: {
                        provider,
                        model: tempConfig.provider === 'zhipu' ? tempConfig.zhipu.modelName : (tempConfig.provider === 'ollama' ? tempConfig.ollama.modelName : tempConfig.custom.modelName),
                        timestamp: new Date(),
                        request: { prompt: capturedPrompt },
                        response: { text: fullResponse }
                      }
                    }
                  );

                  // Inform user we are generating suggestions
                  yield `data: ${JSON.stringify({ type: 'status', message: 'Génération des suggestions...' })}\n\n`;

                  // Generate Suggestions (Post-processing)
                  try {
                    const suggestionsService = new SuggestionsService(strapi);
                    // Use tempConfig which has the correct provider info
                    const suggestions = await suggestionsService.generateSuggestions(message, fullResponse, tempConfig);

                    if (suggestions && suggestions.length > 0) {
                      yield `data: ${JSON.stringify({ type: 'suggestions', content: suggestions })}\n\n`;
                    }
                  } catch (suggError) {
                    console.warn('⚠️ Suggestion generation failed:', suggError);
                  }

                  // Signal completion finally
                  yield `data: ${JSON.stringify({ type: 'complete', provider: provider })}\n\n`;

                  return; // Exit stream generator
                }

              } catch (err) {
                console.warn(`🚨 PROVIDER ERROR [${provider}]:`, err);
                console.warn(`⚠️ switching to next provider...`);
                lastError = err;
                // Continue to next provider
              }
            } // end for loop

            if (!success) {
              console.error('❌ All streaming providers failed');
              yield `data: ${JSON.stringify({ type: 'error', message: lastError?.message || 'All providers failed' })}\n\n`;
            }
          },
          sessionId,
        };
      } catch (error) {
        strapi.log.error('Error in PaulIA langchain stream service:', error);
        throw error;
      }
    },

    // Supprimer une session
    async deleteSession(sessionId: string) {
      try {
        const messages = await strapi.entityService.findMany('plugin::llm-chat.chat-message', {
          filters: { session: { sessionId } }
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
