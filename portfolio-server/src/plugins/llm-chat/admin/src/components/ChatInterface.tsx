import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  TextInput,
  Textarea,
  Typography,
  Flex,
  Card,
  Stack,
  IconButton,
  Badge,
  Select,
  Option
} from '@strapi/design-system';
import { Play, Trash, User, Magic } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';
// @ts-expect-error temporary until types are fixed
import { request } from '@strapi/sdk-plugin';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatInterfaceProps {
  defaultSystemPrompt?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ defaultSystemPrompt = "You are a helpful assistant." }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(`session-${Date.now()}`);
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('openai');
  const [temperature, setTemperature] = useState('0.7');
  const [showConfig, setShowConfig] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { formatMessage } = useIntl();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load existing chat history when session ID changes
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await request(`/${PLUGIN_ID}/history?sessionId=${sessionId}`, {
          method: 'GET',
        }) as any; // Type as any to avoid TypeScript errors

        if (response && response.history && Array.isArray(response.history)) {
          const formattedMessages = response.history.map((msg: any) => ({
            role: msg._getType() === 'human' ? 'user' : 'assistant',
            content: msg.text,
            timestamp: new Date().toISOString(),
          }));
          setMessages(formattedMessages);
        }
      } catch (err) {
        console.error('Failed to load chat history', err);
      }
    };

    fetchHistory();
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to the chat
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');
    setIsLoading(true);    try {
      // Créer un FormData pour la requête
      const formData = new FormData();
      formData.append('message', input);
      formData.append('sessionId', sessionId);
      formData.append('systemPrompt', systemPrompt);
      formData.append('temperature', temperature);

      const response = await request(`/${PLUGIN_ID}/chat`, {
        method: 'POST',
        body: formData,
      }) as any; // Utiliser any temporairement pour éviter les erreurs de type

      if (response && response.response) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      console.error('Failed to send message', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await request(`/${PLUGIN_ID}/history?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      setMessages([]);
      // Generate a new session ID to force a fresh conversation
      setSessionId(`session-${Date.now()}`);
    } catch (err) {
      console.error('Failed to clear chat history', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Stack spacing={4}>
      {/* Chat configuration panel */}
      <Flex justifyContent="space-between" alignItems="center">
        <Button variant="tertiary" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? 'Hide Configuration' : 'Show Configuration'}
        </Button>
        <Badge active>{sessionId}</Badge>
        <IconButton onClick={clearChat} label="Clear chat" icon={<Trash />} />
      </Flex>

      {showConfig && (
        <Card padding={4}>
          <Stack spacing={2}>
            <Typography variant="beta">Chat Configuration</Typography>

            <Box>
              <Typography variant="delta">System Prompt</Typography>
              <Textarea
                name="systemPrompt"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
                value={systemPrompt}
                placeholder="Instructions for the AI..."
              />
            </Box>

            <Box>
              <Typography variant="delta">Provider</Typography>
              <Select
                value={provider}
                onChange={setProvider}
                placeholder="Select provider"
              >
                <Option value="openai">OpenAI</Option>
                <Option value="custom">Custom API</Option>
              </Select>
            </Box>

            <Box>
              <Typography variant="delta">Temperature ({temperature})</Typography>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemperature(e.target.value)}
                style={{ width: '100%' }}
              />
            </Box>
          </Stack>
        </Card>
      )}

      {/* Chat messages */}
      <Box
        padding={4}
        background="neutral100"
        style={{
          height: '500px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}
      >
        {messages.length === 0 ? (
          <Flex justifyContent="center" alignItems="center" style={{ height: '100%' }}>
            <Typography variant="omega" textColor="neutral600">
              {formatMessage({
                id: getTranslation('chat.start'),
                defaultMessage: 'Start a conversation...'
              })}
            </Typography>
          </Flex>
        ) : (
          messages.map((message, index) => (
            <Box
              key={index}
              padding={3}
              marginBottom={3}
              background={message.role === 'assistant' ? 'neutral0' : 'primary100'}
              hasRadius
              shadow="tableShadow"
            >
              <Flex gap={2}>
                <Box paddingRight={2}>
                  {message.role === 'user' ? <User /> : <Magic />}
                </Box>
                <Box>
                  <Typography variant="epsilon" fontWeight="bold">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </Typography>
                  <Typography style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                </Box>
              </Flex>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Error message if any */}
      {error && (
        <Typography variant="pi" textColor="danger600">
          {error}
        </Typography>
      )}

      {/* Input area */}
      <Box>
        <Flex gap={2}>
          <Box grow={1}>
            <TextInput
              placeholder={formatMessage({
                id: getTranslation('chat.inputPlaceholder'),
                defaultMessage: 'Type your message...'
              })}
              aria-label="Chat input"
              name="chatInput"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              value={input}
              disabled={isLoading}
              onKeyDown={handleKeyDown}
            />
          </Box>
          <Button
            variant="default"
            startIcon={<Play />}
            onClick={sendMessage}
            loading={isLoading}
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </Flex>
      </Box>
    </Stack>
  );
};

export default ChatInterface;
