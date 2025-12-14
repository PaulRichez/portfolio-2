import type { Core } from '@strapi/strapi';
// Removed ChatOpenAI import as we are moving to fetch for consistency

/**
 * Service dédié à la génération de suggestions de conversation
 */
export class SuggestionsService {
    private strapi: Core.Strapi;

    constructor(strapi: Core.Strapi) {
        this.strapi = strapi;
    }

    /**
     * Génère 3 suggestions de questions basées sur le contexte
     */
    async generateSuggestions(
        lastUserMessage: string,
        lastAssistantResponse: string,
        providerConfig: any
    ): Promise<string[]> {
        const timerId = `💡 Suggestions Generation [${Date.now()}]`;
        console.time(timerId);

        try {
            this.strapi.log.info('💡 Generating suggestions...');
            console.log('💡 Generating suggestions for:', {
                userMessage: lastUserMessage,
                assistantResponsePreview: lastAssistantResponse.substring(0, 100) + '...',
                provider: providerConfig?.provider
            });

            const prompt = `
Context:
User asked: "${lastUserMessage}"
Assistant answered: "${lastAssistantResponse.substring(0, 500)}..."

Task:
Generate 3 short, relevant follow-up questions the user might want to ask Paul.
The questions should be in French, short (max 10 words), and relevant to Paul's portfolio (projects, skills, contact).

Format:
Return ONLY a JSON array of strings. No markdown, no "json" tags.
Example: ["Question 1?", "Question 2?", "Question 3?"]
`;

            let output = '';

            // Configuration for the fetch call
            let url = '';
            let headers: any = { 'Content-Type': 'application/json' };
            let body: any = {};

            if (providerConfig.provider === 'zhipu') {
                console.log('💡 Using Zhipu (via fetch) for suggestions');
                const apiKey = providerConfig.zhipu.apiKey;
                const modelName = providerConfig.zhipu.modelName || 'glm-4-flash';

                url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
                headers['Authorization'] = `Bearer ${apiKey}`;

                body = {
                    model: modelName,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 200,
                    stream: false
                };

            } else {
                console.log('💡 Using Ollama/Custom (via fetch) for suggestions');
                const baseUrl = providerConfig.ollama?.baseUrl || process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:11434';
                const modelName = providerConfig.ollama?.modelName || 'qwen2.5:1.5b';

                // Using standard generate endpoint for Ollama
                url = `${baseUrl}/api/generate`;
                console.log(`💡 Ollama target: ${baseUrl}, model: ${modelName}`);

                body = {
                    model: modelName,
                    prompt: prompt, // Ollama generate uses 'prompt', not messages
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_ctx: 1024
                    }
                };
            }

            // Execute Fetch
            try {
                console.log('🚀 Sending suggestion request to:', url);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
                    const errorText = await response.text();
                    console.error('❌ Error body:', errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json() as any;
                console.log('📦 Raw response data structure keys:', Object.keys(data));

                // Extract output based on provider format
                if (providerConfig.provider === 'zhipu') {
                    // Deep inspection for Zhipu
                    console.log('📦 Zhipu Choices Dump:', JSON.stringify(data.choices, null, 2));

                    if (data.choices && data.choices.length > 0) {
                        const firstChoice = data.choices[0];
                        if (firstChoice.message?.content) {
                            output = firstChoice.message.content;
                        } else if (firstChoice.delta?.content) {
                            // Fallback if it acted like a stream
                            output = firstChoice.delta.content;
                        } else {
                            console.warn('⚠️ Zhipu choice found but content is missing/empty:', firstChoice);
                        }
                    } else {
                        console.warn('⚠️ Unexpected Zhipu format (no choices):', JSON.stringify(data).substring(0, 200));
                    }
                } else {
                    // Ollama format
                    output = data.response;
                }

            } catch (fetchError) {
                console.error('❌ Fetch call failed:', fetchError);
                throw fetchError;
            }

            if (!output) {
                console.warn('⚠️ No output string extracted from response');
                console.timeEnd(timerId);
                return [];
            }

            console.log('🤖 Raw suggestions text:', output);

            // Parsing Logic
            let suggestions: string[] = [];
            let strategy = 'none';
            try {
                const jsonArrayMatch = output.match(/\[.*?\]/s);
                if (jsonArrayMatch) {
                    strategy = 'regex-json-match';
                    const potentialJson = jsonArrayMatch[0];
                    console.log('🔍 Found JSON array candidate:', potentialJson);
                    const parsed = JSON.parse(potentialJson);
                    if (Array.isArray(parsed)) {
                        suggestions = parsed;
                    }
                } else {
                    strategy = 'markdown-clean';
                    const cleanOutput = output.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
                    if (cleanOutput.startsWith('[') || cleanOutput.startsWith('{')) {
                        const parsed = JSON.parse(cleanOutput);
                        if (Array.isArray(parsed)) {
                            suggestions = parsed;
                        } else if (parsed.questions && Array.isArray(parsed.questions)) {
                            suggestions = parsed.questions;
                        }
                    } else {
                        throw new Error('Does not look like JSON');
                    }
                }
            } catch (parsingError) {
                console.warn(`⚠️ Failed to parse suggestions JSON (Strategy: ${strategy}):`, parsingError.message);
                console.log('🔄 Attempting manual fallback parsing...');
                // Fallback manual parsing: look for lines with '?'
                suggestions = output.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 5 && line.includes('?'))
                    .map(l => l.replace(/^[-*•\d\.]+\s*/, '').replace(/^["']|["']$/g, '').trim())
                    .slice(0, 3);

                console.log('🔄 Manual parsing results:', suggestions);
            }

            const finalSuggestions = suggestions.slice(0, 3);
            console.log('✅ Final suggestions returned:', finalSuggestions);
            console.timeEnd(timerId);
            return finalSuggestions;

        } catch (error) {
            console.timeEnd(timerId);
            this.strapi.log.error('❌ Error generating suggestions:', error);
            console.error('❌ Full suggestion error details:', error);
            return [];
        }
    }
}
