import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  TextInput,
  Textarea,
  Typography,
  Flex,
  Card,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  Divider
} from '@strapi/design-system';
import { Play, Trash, User, Magic } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useFetchClient } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatInterfaceProps {
  defaultSystemPrompt?: string;
}

interface Session {
  sessionId: string;
  messageCount: number;
  lastActivity: string;
  lastMessage: string;
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { formatMessage } = useIntl();
  const { get, post, del } = useFetchClient();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  // Load all sessions
  const fetchSessions = async () => {
    try {
      const response = await get(`/${PLUGIN_ID}/sessions`) as any;
      if (response && response.data && response.data.sessions) {
        setSessions(response.data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  };

  // Load existing chat history when session ID changes
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await get(`/${PLUGIN_ID}/history?sessionId=${sessionId}`) as any;

        if (response && response.data && response.data.messages && Array.isArray(response.data.messages)) {
          const formattedMessages = response.data.messages.map((msg: any) => ({
            role: msg._getType() === 'human' ? 'user' : 'assistant',
            content: msg.content || msg.text,
            timestamp: msg.timestamp || new Date().toISOString(),
          }));
          setMessages(formattedMessages);
        }
      } catch (err) {
        console.error('Failed to load chat history', err);
      }
    };

    fetchHistory();
    fetchSessions();
  }, [sessionId, get]);

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
    setError('');    setIsLoading(true);

    try {
      // Create form data for the request
      const formData = new FormData();
      formData.append('message', input);
      formData.append('sessionId', sessionId);
      formData.append('systemPrompt', systemPrompt);
      formData.append('temperature', temperature);

      const response = await post(`/${PLUGIN_ID}/chat`, formData) as any;

      if (response && response.data && response.data.response) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.response,
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
      await del(`/${PLUGIN_ID}/history?sessionId=${sessionId}`);
      setMessages([]);
      // Generate a new session ID to force a fresh conversation
      setSessionId(`session-${Date.now()}`);
    } catch (err) {
      console.error('Failed to clear chat history', err);
    }
  };

  const clearAllChats = async () => {
    try {
      await del(`/${PLUGIN_ID}/history/all`);
      setMessages([]);
      setSessions([]);
      setSessionId(`session-${Date.now()}`);
    } catch (err) {
      console.error('Failed to clear all chat history', err);
    }
  };

  const loadSession = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    setShowHistoryModal(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  return (
    <Flex direction="column" gap={4}>
      {/* Chat configuration panel */}
      <Flex justifyContent="space-between" alignItems="center">
        <Button variant="tertiary" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? 'Hide Configuration' : 'Show Configuration'}
        </Button>
        <Flex gap={2} alignItems="center">
          <Badge active>{sessionId}</Badge>
          <Button variant="secondary" onClick={() => setShowHistoryModal(true)}>
            History ({sessions.length})
          </Button>
          <Button variant="secondary" startIcon={<Trash />} onClick={clearChat}>
            Clear chat
          </Button>
          <Button variant="danger" onClick={clearAllChats}>
            Clear all
          </Button>
        </Flex>
      </Flex>

      {/* History Modal */}
      <Modal.Root open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <Modal.Content>
          <Modal.Header>
            <Typography variant="beta">Chat History</Typography>
          </Modal.Header>
          <Modal.Body>
            {sessions.length === 0 ? (
              <Typography>No chat sessions found.</Typography>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Session ID</Th>
                    <Th>Messages</Th>
                    <Th>Last Activity</Th>
                    <Th>Preview</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sessions.map((session) => (
                    <Tr key={session.sessionId}>
                      <Td>
                        <Typography variant="omega">
                          {session.sessionId.slice(0, 20)}...
                        </Typography>
                      </Td>
                      <Td>
                        <Badge>{session.messageCount}</Badge>
                      </Td>
                      <Td>
                        <Typography variant="pi">
                          {formatDate(session.lastActivity)}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography variant="pi" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {session.lastMessage}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex gap={2}>
                          <Button size="S" onClick={() => loadSession(session.sessionId)}>
                            Load
                          </Button>
                          <Button size="S" variant="danger" onClick={() => clearChat()}>
                            Delete
                          </Button>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      {showConfig && (
        <Card padding={4}>
          <Flex direction="column" gap={2}>
            <Typography variant="beta">Chat Configuration</Typography>

            <Box>
              <Typography variant="delta">System Prompt</Typography>
              <Textarea
                name="systemPrompt"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
                value={systemPrompt}
                placeholder="Instructions for the AI..."
              />
            </Box>            <Box>
              <Typography variant="delta">Provider</Typography>
              <TextInput
                name="provider"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProvider(e.target.value)}
                value={provider}
                placeholder="openai"
              />
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
              />            </Box>
          </Flex>
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
          </Button>        </Flex>
      </Box>
    </Flex>
  );
};

export default ChatInterface;
