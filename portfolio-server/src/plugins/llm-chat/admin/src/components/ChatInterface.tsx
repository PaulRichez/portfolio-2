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
import ReactMarkdown from 'react-markdown';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';
import './ChatInterface.css';

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
  title?: string;
  messageCount: number;
  lastActivity: string;
  lastMessage: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ defaultSystemPrompt = "You are a helpful assistant." }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(`session-${Date.now()}`);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);

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
            role: msg.role, // Now comes directly from database
            content: msg.content,
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

    const currentInput = input;
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', currentInput);
      formData.append('sessionId', sessionId);

      const response = await post(`/${PLUGIN_ID}/chat`, formData) as any;

      if (response && response.data && response.data.response) {
        // Recharger l'historique complet depuis la base de données
        const historyResponse = await get(`/${PLUGIN_ID}/history?sessionId=${sessionId}`) as any;
        if (historyResponse && historyResponse.data && historyResponse.data.messages) {
          const formattedMessages = historyResponse.data.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp || new Date().toISOString(),
          }));
          setMessages(formattedMessages);
        }

        // Recharger les sessions
        await fetchSessions();
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
      await fetchSessions();
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
      await fetchSessions();
    } catch (err) {
      console.error('Failed to clear all chat history', err);
    }
  };

  const loadSession = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    setShowHistoryModal(false);
    // L'effet useEffect se chargera de recharger l'historique
  };

  const deleteSession = async (sessionIdToDelete: string) => {
    try {
      await del(`/${PLUGIN_ID}/sessions/${sessionIdToDelete}`);
      await fetchSessions();

      if (sessionIdToDelete === sessionId) {
        setMessages([]);
        setSessionId(`session-${Date.now()}`);
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  // Ajouter une fonction pour forcer la synchronisation
  const refreshFromDatabase = async () => {
    try {
      // Recharger l'historique de la session actuelle
      const historyResponse = await get(`/${PLUGIN_ID}/history?sessionId=${sessionId}`) as any;
      if (historyResponse && historyResponse.data && historyResponse.data.messages && Array.isArray(historyResponse.data.messages)) {
        const formattedMessages = historyResponse.data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || new Date().toISOString(),
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }

      // Recharger toutes les sessions
      await fetchSessions();
    } catch (err) {
      console.error('Failed to refresh from database', err);
    }
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

  const testStreaming = async () => {
    console.log('Testing chat endpoint...');
    try {
      const formData = new FormData();
      formData.append('message', 'Hello, test chat');
      formData.append('sessionId', sessionId);

      const response = await post(`/${PLUGIN_ID}/chat`, formData) as any;

      console.log('Chat response:', response);

      if (response && response.data) {
        console.log('Chat response received successfully');
      }
    } catch (error) {
      console.error('Chat test failed:', error);
    }
  };

  const startEditingTitle = (session: Session) => {
    setEditingSessionId(session.sessionId);
    setEditingTitle(session.title || session.sessionId);
  };

  const saveSessionTitle = async (sessionIdToUpdate: string) => {
    try {
      await post(`/${PLUGIN_ID}/sessions/${sessionIdToUpdate}/title`, {
        title: editingTitle
      });

      setSessions(sessions.map(s =>
        s.sessionId === sessionIdToUpdate
          ? { ...s, title: editingTitle }
          : s
      ));

      setEditingSessionId(null);
      setEditingTitle('');
    } catch (err) {
      console.error('Failed to update session title', err);
    }
  };

  const cancelEditingTitle = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  return (
    <Flex direction="column" gap={4}>
      {/* Chat controls */}
      <Flex justifyContent="space-between" alignItems="center">
        <Typography variant="beta">LLM Chat Interface</Typography>
        <Flex gap={2} alignItems="center">
          <Button variant="tertiary" onClick={testStreaming}>
            Test Chat
          </Button>
          <Button variant="tertiary" onClick={refreshFromDatabase}>
            🔄 Refresh
          </Button>
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
                    <Th>Title</Th>
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
                        {editingSessionId === session.sessionId ? (
                          <Flex gap={1}>
                            <TextInput
                              value={editingTitle}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTitle(e.target.value)}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter') {
                                  saveSessionTitle(session.sessionId);
                                } else if (e.key === 'Escape') {
                                  cancelEditingTitle();
                                }
                              }}
                            />
                            <Button size="S" onClick={() => saveSessionTitle(session.sessionId)}>
                              Save
                            </Button>
                            <Button size="S" variant="tertiary" onClick={cancelEditingTitle}>
                              Cancel
                            </Button>
                          </Flex>
                        ) : (
                          <Flex alignItems="center" gap={2}>
                            <Typography
                              variant="omega"
                              style={{ cursor: 'pointer' }}
                              onClick={() => startEditingTitle(session)}
                            >
                              {session.title || 'Untitled Chat'}
                            </Typography>
                          </Flex>
                        )}
                      </Td>
                      <Td>
                        <Typography variant="pi" style={{ fontSize: '0.75rem', color: '#666' }}>
                          {session.sessionId.slice(0, 15)}...
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
                          <Button size="S" variant="danger" onClick={() => deleteSession(session.sessionId)}>
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
                    {isStreaming && index === streamingMessageIndex && (
                      <span style={{ marginLeft: '8px', animation: 'blink 1s infinite' }}>▋</span>
                    )}
                  </Typography>
                  {message.role === 'user' ? (
                    <Typography style={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
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
