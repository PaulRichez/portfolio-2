import axios from 'axios';

import { PLUGIN_ID } from '../pluginId';

/**
 * Helper function for making API calls to the plugin backend
 */
export const apiClient = {
  /**
   * Send a message to the LLM and get a response
   */
  chat: async (message: string, options?: {
    sessionId?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }) => {
    // Créer un FormData pour la requête
    const formData = new FormData();
    formData.append('message', message);

    if (options?.sessionId) {
      formData.append('sessionId', options.sessionId);
    }

    if (options?.systemPrompt) {
      formData.append('systemPrompt', options.systemPrompt);
    }

    if (options?.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    if (options?.maxTokens !== undefined) {
      formData.append('maxTokens', options.maxTokens.toString());
    }

    return axios.post(`/${PLUGIN_ID}/chat`, formData);
  },

  /**
   * Get the history for a specific chat session
   */
  getHistory: async (sessionId?: string) => {
    const url = `/${PLUGIN_ID}/history${sessionId ? `?sessionId=${sessionId}` : ''}`;
    return axios.get(url);
  },

  /**
   * Clear the history for a specific chat session
   */
  clearHistory: async (sessionId?: string) => {
    const url = `/${PLUGIN_ID}/history${sessionId ? `?sessionId=${sessionId}` : ''}`;
    return axios.delete(url);
  },
};
