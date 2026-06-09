export default () => ({
    "llm-chat": {
        enabled: true,
        resolve: `./src/plugins/llm-chat`,
        config: {
            // Chat generation runs on Zhipu GLM-4-Flash (free, OpenAI-compatible cloud).
            // Embeddings stay local (see EMBEDDING_BASE_URL) so the host needs no big model.
            provider: process.env.LLM_PROVIDER || 'zhipu',
            // Single provider: the full CV is injected into the prompt (no RAG, no local model).
            providerOrder: ['zhipu'],
            zhipu: {
                apiKey: process.env.ZHIPU_API_KEY || '',
                modelName: process.env.ZHIPU_MODEL_NAME || 'glm-4-flash',
            },
            openai: {
                apiKey: process.env.OPENAI_API_KEY || '',
                modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
                temperature: process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.2,
            },
            custom: {
                baseUrl: process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:11434',
                modelName: process.env.CUSTOM_LLM_MODEL_NAME || 'qwen3:0.6b',
                temperature: process.env.CUSTOM_LLM_TEMPERATURE ? parseFloat(process.env.CUSTOM_LLM_TEMPERATURE) : 0.2,
                apiKey: process.env.CUSTOM_LLM_API_KEY || '',
            },
        },
    },
});
