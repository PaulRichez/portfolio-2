export default {
  default: {
    provider: 'zhipu',
    providerOrder: ['zhipu', 'ollama'], // Default failover order
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY || '',
      modelName: 'glm-4.5-flash',
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      modelName: 'qwen2.5:1.5b',
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
    if (config.providerOrder && !Array.isArray(config.providerOrder)) {
      throw new Error('providerOrder must be an array of strings');
    }
    if (config.provider === 'zhipu' && !config.zhipu?.apiKey) {
      throw new Error('Zhipu API Key is required when using Zhipu provider');
    }
    if (config.provider === 'custom' && !config.custom?.baseUrl) {
      throw new Error('Base URL is required when using custom provider');
    }
  },
};
