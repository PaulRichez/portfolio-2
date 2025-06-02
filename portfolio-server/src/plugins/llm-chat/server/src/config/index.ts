export default {
  default: {
    provider: 'openai',
    openai: {
      apiKey: '',
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
    },
    custom: {
      baseUrl: 'http://localhost:11434/v1',
      modelName: 'llama2',
      temperature: 0.7,
      apiKey: '',
    }
  },
  validator(config) {
    if (!config.provider) {
      throw new Error('LLM provider is required in plugin configuration');
    }
    if (config.provider === 'openai' && !config.openai?.apiKey) {
      throw new Error('OpenAI API Key is required when using OpenAI provider');
    }
    if (config.provider === 'custom' && !config.custom?.baseUrl) {
      throw new Error('Base URL is required when using custom provider');
    }
  },
};
