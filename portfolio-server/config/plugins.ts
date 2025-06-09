export default () => ({
    "llm-chat": {
        enabled: true,
        resolve: `./src/plugins/llm-chat`,
        config: {
            provider: process.env.LLM_PROVIDER || 'custom',
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
