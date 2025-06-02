import type { Core } from '@strapi/strapi';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";

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

const langchainService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async createChat(message: string) {
    try {
      const config = strapi.plugin('llm-chat').config('') as unknown as LlmChatConfig;
      let model;

      if (config.provider === 'openai') {
        model = new ChatOpenAI({
          modelName: config.openai.modelName,
          temperature: config.openai.temperature,
          openAIApiKey: config.openai.apiKey,
        });
      } else if (config.provider === 'custom') {
        model = new ChatOpenAI({
          modelName: config.custom.modelName,
          temperature: config.custom.temperature,
          configuration: {
            baseURL: config.custom.baseUrl,
            apiKey: config.custom.apiKey || "not-needed",
          },
        });
      } else {
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
      }

      const template = '{message}';
      const prompt = new PromptTemplate({
        template,
        inputVariables: ['message'],
      });

      const chain = new LLMChain({
        llm: model,
        prompt,
      });

      const response = await chain.call({
        message,
      });

      return response.text;
    } catch (error) {
      strapi.log.error('Error in langchain service:', error);
      throw error;
    }
  },
});

export default langchainService;
