export default () => ({    "llmchat": {
        enabled: true,
        resolve: `./src/plugins/llm-chat`,
        config: {
            provider: process.env.LLM_PROVIDER || 'openai',
            openai: {
                apiKey: process.env.OPENAI_API_KEY || '',
                modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
                temperature: process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.7,
            },
            custom: {
                baseUrl: process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:11434/v1',
                modelName: process.env.CUSTOM_LLM_MODEL_NAME || 'llama2',
                temperature: process.env.CUSTOM_LLM_TEMPERATURE ? parseFloat(process.env.CUSTOM_LLM_TEMPERATURE) : 0.7,
                apiKey: process.env.CUSTOM_LLM_API_KEY || '',
            },
        },
    },
});
