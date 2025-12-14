import type { Core } from '@strapi/strapi';
import { LlmChatConfig } from '../services/langchain-service';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
    async getStats(ctx) {
        try {
            // Get config from store first (dynamic), fallback to file config (static)
            const pluginStore = strapi.store({
                environment: '',
                type: 'plugin',
                name: 'llm-chat',
                key: 'config',
            });

            const storedConfig = await pluginStore.get();

            console.log('📊 [ModelController] Stored Config:', JSON.stringify(storedConfig, null, 2));

            const fileConfig = (strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default')) as LlmChatConfig;

            console.log('µ [ModelController] File Config ProviderOrder:', fileConfig.providerOrder);

            const pluginConfig = {
                ...fileConfig,
                ...(storedConfig as object)
            };

            console.log('✅ [ModelController] Final Merged Config Order:', pluginConfig.providerOrder);

            // Basic connectivity check for configured providers
            const stats = {
                zhipu: {
                    status: 'unknown',
                    model: pluginConfig.zhipu?.modelName,
                    latency: 0
                },
                ollama: {
                    status: 'unknown',
                    model: pluginConfig.ollama?.modelName,
                    latency: 0
                },
                custom: {
                    status: 'unknown',
                    model: pluginConfig.custom?.modelName,
                    latency: 0
                },
                config: {
                    providerOrder: pluginConfig.providerOrder || ['zhipu', 'ollama'],
                    currentProvider: pluginConfig.provider
                }
            };

            // Check Zhipu (via simple request if possible, or assumption)
            // Since we don't want to burn tokens, we assume 'online' if configured for now, 
            // or we could implementing a 'ping' if the API supports it.
            if (pluginConfig.zhipu?.apiKey) {
                stats.zhipu.status = 'configured';
                // Note: Real connectivity check would require a small API call
            } else {
                stats.zhipu.status = 'not-configured';
            }

            // Check Ollama (Ping)
            if (pluginConfig.ollama?.baseUrl) {
                try {
                    const start = Date.now();
                    const response = await fetch(`${pluginConfig.ollama.baseUrl.replace(/\/v1$/, '')}/api/tags`); // Standard Ollama endpoint
                    if (response.ok) {
                        stats.ollama.status = 'online';
                        stats.ollama.latency = Date.now() - start;
                    } else {
                        stats.ollama.status = 'offline';
                    }
                } catch (e) {
                    stats.ollama.status = 'offline';
                }
            }

            ctx.body = stats;
        } catch (error) {
            ctx.throw(500, error);
        }
    },

    async updateConfig(ctx) {
        try {
            const { providerOrder } = ctx.request.body;

            if (!Array.isArray(providerOrder)) {
                return ctx.badRequest('providerOrder must be an array');
            }

            const pluginStore = strapi.store({
                environment: '',
                type: 'plugin',
                name: 'llm-chat',
                key: 'config',
            });

            const currentConfig = await pluginStore.get() || strapi.plugin('llm-chat').config('default');

            const newConfig = {
                ...(currentConfig as any),
                providerOrder
            };

            await pluginStore.set({ value: newConfig });

            // Also update runtime config if possible/needed, usually Strapi requires restart or reload for config file changes,
            // but store changes are dynamic. We need to make sure the service reads from store first.

            ctx.body = { message: 'Configuration updated', config: newConfig };
        } catch (error) {
            ctx.throw(500, error);
        }
    }
});
