import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
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
  Alert,
  TextInput,
  Divider,
  Checkbox
} from '@strapi/design-system';
import {
  ArrowClockwise,
  Database,
  Search,
  Trash,
  Play,
  Stop,
  Information,
  Check,
  Cross,
  Cog,
  Eye
} from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useFetchClient } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';

interface VectorStats {
  collection_name?: string;
  document_count?: number;
  indexed_collections?: string[];
  last_updated?: string;
  totalDocuments?: number;
  collections?: string[];
  lastSync?: string;
  health?: 'healthy' | 'warning' | 'error';
  chromaConnection?: boolean;
  ollamaConnection?: boolean;
}

interface CollectionInfo {
  name: string;
  count: number;
  lastUpdated: string;
  enabled: boolean;
}

interface SearchResult {
  id: string;
  content: string;
  metadata: {
    strapi_id: number;
    collection: string;
    title?: string;
    [key: string]: any;
  };
  distance: number;
}

interface DocumentItem {
  id: string;
  document: string;
  metadata: {
    strapi_id: number;
    collection: string;
    title?: string;
    [key: string]: any;
  };
  collection: string;
}

interface SyncStatus {
  isRunning: boolean;
  progress: number;
  currentOperation: string;
  error?: string;
}

const VectorManagementInterface: React.FC = () => {
  // États principaux
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // États pour la recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // États pour les documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'search' | 'documents' | 'export'>('search');
  const [selectedCollectionDocs, setSelectedCollectionDocs] = useState<string>('');

  // États pour l'export
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  // États pour la synchronisation
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRunning: false,
    progress: 0,
    currentOperation: ''
  });

  // États pour les modales
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');

  const { formatMessage } = useIntl();
  const { get, post, del } = useFetchClient();

  // Charger les données initiales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      fetchStats(),
      fetchCollections(),
      testConnections() // Automatically test connections on load
    ]);
  };

  const fetchStats = async () => {
    try {
      const response = await get(`/${PLUGIN_ID}/vectors/stats`) as any;
      if (response?.data?.stats) {
        setStats(response.data.stats);
      } else if (response?.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch vector stats:', err);
      setError(err.message || 'Failed to fetch stats');
      // Set default disconnected state on error
      setStats(prev => ({
        ...prev,
        chromaConnection: false,
        ollamaConnection: false,
        health: 'error'
      }));
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await get(`/${PLUGIN_ID}/vectors/collections`) as any;
      if (response?.data?.collections) {
        setCollections(response.data.collections);
      }
    } catch (err: any) {
      console.error('Failed to fetch collections:', err);
    }
  };

  const fetchDocuments = async () => {
    setDocumentsLoading(true);
    try {
      const response = await get(`/${PLUGIN_ID}/vectors/documents?limit=50&offset=0`) as any;
      if (response?.data?.documents) {
        setDocuments(response.data.documents);
      }
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
      setError(err.message || 'Failed to fetch documents');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchCollectionDocuments = async (collectionName: string) => {
    setDocumentsLoading(true);
    setSelectedCollectionDocs(collectionName);
    setCurrentTab('documents');

    try {
      const response = await get(`/${PLUGIN_ID}/vectors/documents?limit=50&offset=0`) as any;
      if (response?.data?.documents) {
        // Filter documents by collection
        const filteredDocs = response.data.documents.filter((doc: DocumentItem) =>
          doc.metadata.collection === collectionName
        );
        setDocuments(filteredDocs);
      }
    } catch (err: any) {
      console.error('Failed to fetch collection documents:', err);
      setError(err.message || 'Failed to fetch collection documents');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const testConnections = async () => {
    setIsLoading(true);
    try {
      const response = await post(`/${PLUGIN_ID}/vectors/test-connection`, {}) as any;
      if (response?.data) {
        const connectionData = response.data;
        // Merge connection status with existing stats
        setStats(prev => ({
          ...prev,
          chromaConnection: connectionData.details?.chroma?.status === 'connected',
          ollamaConnection: connectionData.details?.ollama?.status === 'connected',
          health: connectionData.status === 'connected' ? 'healthy' :
                  connectionData.status === 'partial' ? 'warning' : 'error'
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
      // Update stats to show disconnected status
      setStats(prev => ({
        ...prev,
        chromaConnection: false,
        ollamaConnection: false,
        health: 'error'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const response = await post(`/${PLUGIN_ID}/vectors/search`, {
        query: searchQuery,
        limit: 10
      }) as any;

      if (response?.data?.results) {
        setSearchResults(response.data.results);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSync = async (collection?: string) => {
    setSyncStatus({
      isRunning: true,
      progress: 0,
      currentOperation: collection ? `Syncing ${collection}...` : 'Full sync starting...'
    });

    try {
      const endpoint = collection
        ? `/${PLUGIN_ID}/vectors/sync/collection/${collection}`
        : `/${PLUGIN_ID}/vectors/sync/full`;

      const response = await post(endpoint, {}) as any;

      if (response?.data) {
        setSyncStatus({
          isRunning: false,
          progress: 100,
          currentOperation: 'Sync completed successfully'
        });

        // Recharger les données
        setTimeout(() => {
          loadData();
          setSyncStatus({ isRunning: false, progress: 0, currentOperation: '' });
        }, 2000);
      }
    } catch (err: any) {
      setSyncStatus({
        isRunning: false,
        progress: 0,
        currentOperation: '',
        error: err.message || 'Sync failed'
      });
    }
  };

  const handlePurge = async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedCollection
        ? `/${PLUGIN_ID}/vectors/purge/collection/${selectedCollection}`
        : `/${PLUGIN_ID}/vectors/purge/all`;

      await del(endpoint);
      setShowPurgeModal(false);
      setSelectedCollection('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Purge failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonctions pour l'export
  const handleExportCollections = async () => {
    if (selectedCollections.length === 0) {
      setError('Please select at least one collection to export');
      return;
    }

    setExportLoading(true);
    try {
      // Utiliser le client Strapi pour l'authentification automatique
      const response = await post(`/${PLUGIN_ID}/vectors/export`, {
        collections: selectedCollections
      }) as any;

      // Debug: log de la réponse complète
      console.log('Export response:', response);
      console.log('Response type:', typeof response);
      console.log('Response data:', response?.data);

      let content: string = '';

      // Vérifier la nouvelle structure de réponse JSON du serveur
      if (response?.data?.success && response?.data?.content) {
        content = response.data.content;
        console.log('Content from response.data.content:', content.substring(0, 100) + '...');
      } else if (response?.data && typeof response.data === 'string' && response.data.trim()) {
        content = response.data;
        console.log('Content from response.data (string):', content.substring(0, 100) + '...');
      } else if (typeof response === 'string' && response.trim()) {
        content = response;
        console.log('Content from response (string):', content.substring(0, 100) + '...');
      } else if (response && typeof response === 'object') {
        // Si c'est un objet, le sérialiser en JSON lisible
        content = JSON.stringify(response, null, 2);
        console.log('Content from JSON.stringify:', content.substring(0, 100) + '...');
      }

      // Vérifier si on a du contenu
      if (!content || content.trim() === '') {
        throw new Error('Export returned empty content. Please check if the selected collections contain data.');
      }

      // Créer et télécharger le fichier
      const filename = response?.data?.filename || `chroma-export-${new Date().toISOString().split('T')[0]}.txt`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setError('');
      setSelectedCollections([]);

      // Message de succès
      console.log(`Export successful! Downloaded ${content.length} characters as ${filename}.`);

    } catch (err: any) {
      console.error('Failed to export collections:', err);
      setError(err.message || 'Failed to export collections');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCollectionToggle = (collectionName: string) => {
    setSelectedCollections(prev =>
      prev.includes(collectionName)
        ? prev.filter(name => name !== collectionName)
        : [...prev, collectionName]
    );
  };

  const handleSelectAllCollections = () => {
    if (selectedCollections.length === collections.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(collections.map(col => col.name));
    }
  };

  const getStatusColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <Box padding={6}>
      <Box paddingBottom={4}>
        <Flex justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="alpha">
              Vector RAG Management
            </Typography>
            <Typography variant="epsilon" textColor="neutral600">
              Manage ChromaDB vector storage and document indexing
            </Typography>
          </Box>
          <Flex gap={2}>
            <Button
              variant="secondary"
              startIcon={<ArrowClockwise />}
              onClick={loadData}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              startIcon={<Information />}
              onClick={() => setShowStatsModal(true)}
            >
              Details
            </Button>
          </Flex>
        </Flex>
      </Box>

      {error && (
        <Box paddingBottom={4}>
          <Alert variant="danger" title="Error">
            {error}
          </Alert>
        </Box>
      )}

      {/* Status Overview */}
      <Flex gap={4} paddingBottom={6} wrap="wrap">
        <Box grow={1} minWidth="200px">
          <Card padding={4}>
            <Flex direction="column" alignItems="center" gap={2}>
              <Database />
              <Typography variant="beta">
                {stats?.totalDocuments || stats?.document_count || 0}
              </Typography>
              <Typography variant="pi" textColor="neutral600">
                Total Documents
              </Typography>
            </Flex>
          </Card>
        </Box>

        <Box grow={1} minWidth="200px">
          <Card padding={4}>
            <Flex direction="column" alignItems="center" gap={2}>
              <Cog />
              <Typography variant="beta">
                {stats?.collections?.length || stats?.indexed_collections?.length || 0}
              </Typography>
              <Typography variant="pi" textColor="neutral600">
                Collections
              </Typography>
            </Flex>
          </Card>
        </Box>

        <Box grow={1} minWidth="200px">
          <Card padding={4}>
            <Flex direction="column" alignItems="center" gap={2}>
              <Badge variant={stats?.chromaConnection ? 'success' : 'danger'}>
                {stats?.chromaConnection ? 'Connected' : 'Disconnected'}
              </Badge>
              <Typography variant="pi" textColor="neutral600">
                ChromaDB
              </Typography>
            </Flex>
          </Card>
        </Box>

        <Box grow={1} minWidth="200px">
          <Card padding={4}>
            <Flex direction="column" alignItems="center" gap={2}>
              <Badge variant={stats?.ollamaConnection ? 'success' : 'danger'}>
                {stats?.ollamaConnection ? 'Connected' : 'Disconnected'}
              </Badge>
              <Typography variant="pi" textColor="neutral600">
                Ollama
              </Typography>
            </Flex>
          </Card>
        </Box>
      </Flex>

      {/* Actions */}
      <Card padding={4} paddingBottom={6}>
        <Typography variant="beta" paddingBottom={4}>Quick Actions</Typography>
        <Flex gap={4} wrap="wrap">
          <Button
            variant="default"
            startIcon={<Play />}
            onClick={() => handleSync()}
            disabled={syncStatus.isRunning}
          >
            Full Sync
          </Button>
          <Button
            variant="secondary"
            startIcon={<Database />}
            onClick={testConnections}
            loading={isLoading}
          >
            Test Connections
          </Button>
          <Button
            variant="danger-light"
            startIcon={<Trash />}
            onClick={() => {
              setSelectedCollection('');
              setShowPurgeModal(true);
            }}
          >
            Purge All
          </Button>
        </Flex>

        {/* Progress de synchronisation */}
        {syncStatus.isRunning && (
          <Box paddingTop={4}>
            <Typography variant="pi" paddingBottom={2}>
              {syncStatus.currentOperation}
            </Typography>
            <Box background="neutral200" hasRadius height="8px">
              <Box
                background="primary600"
                hasRadius
                height="100%"
                style={{ width: `${syncStatus.progress}%`, transition: 'width 0.3s ease' }}
              />
            </Box>
          </Box>
        )}

        {syncStatus.error && (
          <Box paddingTop={4}>
            <Alert variant="danger" title="Sync Error">
              {syncStatus.error}
            </Alert>
          </Box>
        )}
      </Card>

      {/* Collections Management */}
      <Card padding={4} paddingBottom={6}>
        <Typography variant="beta" paddingBottom={4}>Collections</Typography>
        {collections.length === 0 ? (
          <Flex direction="column" alignItems="center" justifyContent="center" padding={8}>
            <Database />
            <Typography variant="omega" paddingTop={2} paddingBottom={3}>
              No collections found
            </Typography>
            <Button variant="secondary" onClick={loadData}>
              Refresh
            </Button>
          </Flex>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Collection</Th>
                <Th>Documents</Th>
                <Th>Last Updated</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {collections.map((collection) => (
                <Tr key={collection.name}>
                  <Td>
                    <Typography variant="omega" fontWeight="semiBold">
                      {collection.name}
                    </Typography>
                  </Td>
                  <Td>
                    <Badge>{collection.count}</Badge>
                  </Td>
                  <Td>
                    <Typography variant="pi">
                      {collection.lastUpdated ? new Date(collection.lastUpdated).toLocaleString() : 'Never'}
                    </Typography>
                  </Td>
                  <Td>
                    <Badge variant={collection.enabled ? 'success' : 'secondary'}>
                      {collection.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Td>
                  <Td>
                    <Flex gap={2}>
                      <Button
                        size="S"
                        variant="secondary"
                        startIcon={<ArrowClockwise />}
                        onClick={() => handleSync(collection.name)}
                        disabled={syncStatus.isRunning}
                      >
                        Sync
                      </Button>
                      <Button
                        size="S"
                        variant="tertiary"
                        startIcon={<Eye />}
                        onClick={() => fetchCollectionDocuments(collection.name)}
                        disabled={documentsLoading}
                      >
                        View Docs
                      </Button>
                      <Button
                        size="S"
                        variant="danger-light"
                        startIcon={<Trash />}
                        onClick={() => {
                          setSelectedCollection(collection.name);
                          setShowPurgeModal(true);
                        }}
                      >
                        Purge
                      </Button>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* Vector Search & Documents */}
      <Card padding={4}>
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
          <Typography variant="beta">Vector Operations</Typography>
          <Flex gap={2}>
            <Button
              variant={currentTab === 'search' ? 'primary' : 'secondary'}
              onClick={() => setCurrentTab('search')}
              size="S"
            >
              Search
            </Button>
            <Button
              variant={currentTab === 'documents' ? 'primary' : 'secondary'}
              onClick={() => {
                setCurrentTab('documents');
                if (documents.length === 0 && !selectedCollectionDocs) {
                  fetchDocuments();
                }
              }}
              size="S"
            >
              Documents
            </Button>
            <Button
              variant={currentTab === 'export' ? 'primary' : 'secondary'}
              onClick={() => setCurrentTab('export')}
              size="S"
            >
              Export
            </Button>
          </Flex>
        </Flex>

        {currentTab === 'search' && (
          <Box>
            <Flex gap={2} paddingBottom={4}>
              <Box grow={1}>
                <TextInput
                  placeholder="Enter search query..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                />
              </Box>
              <Button
                startIcon={<Search />}
                onClick={handleSearch}
                loading={searchLoading}
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            </Flex>            {searchResults.length > 0 && (
              <Box>
                <Typography variant="delta" paddingBottom={3}>
                  Search Results ({searchResults.length})
                </Typography>
                {searchResults.map((result, index) => {
                  // Function to render metadata in search results
                  const renderSearchMetadata = (metadata: any) => {
                    const excludeKeys = ['strapi_id', 'collection', 'indexed_at', 'title'];
                    const metadataEntries = Object.entries(metadata)
                      .filter(([key, value]) => !excludeKeys.includes(key) && value !== null && value !== undefined && value !== '')
                      .slice(0, 3) // Limit to 3 most relevant metadata for search results
                      .sort(([a], [b]) => a.localeCompare(b));

                    if (metadataEntries.length === 0) return null;

                    return (
                      <Box background="neutral200" hasRadius padding={2} marginTop={2}>
                        <Typography variant="pi" fontWeight="semiBold" paddingBottom={1} textColor="neutral700">
                          Key Metadata:
                        </Typography>
                        <Flex wrap="wrap" gap={2}>
                          {metadataEntries.map(([key, value]) => (
                            <Badge key={key} variant="neutral">
                              {key.replace(/_/g, ' ')}: {typeof value === 'string' && value.length > 30
                                ? `${value.substring(0, 30)}...`
                                : String(value)
                              }
                            </Badge>
                          ))}
                        </Flex>
                      </Box>
                    );
                  };

                  return (
                    <Card key={result.id} padding={3} marginBottom={2} background="neutral100">
                      <Flex direction="column" gap={2}>
                        <Flex justifyContent="space-between" alignItems="flex-start">
                          <Typography variant="omega" fontWeight="semiBold">
                            {result.metadata.title || result.metadata.collection}
                          </Typography>
                          <Badge>
                            Distance: {result.distance.toFixed(3)}
                          </Badge>
                        </Flex>
                        <Typography variant="pi" textColor="neutral600">
                          Collection: {result.metadata.collection} | ID: {result.metadata.strapi_id}
                        </Typography>
                        <Typography variant="pi" style={{
                          maxHeight: '60px',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {result.content}
                        </Typography>
                        {renderSearchMetadata(result.metadata)}
                      </Flex>
                    </Card>
                  );
                })}
              </Box>
            )}

            {searchQuery && searchResults.length === 0 && !searchLoading && (
              <Box padding={4} background="neutral100" hasRadius>
                <Typography variant="pi" textColor="neutral600">
                  No results found for "{searchQuery}"
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {currentTab === 'documents' && (
          <Box>
            <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
              <Box>
                <Typography variant="delta">
                  Indexed Documents ({documents.length})
                </Typography>
                {selectedCollectionDocs && (
                  <Typography variant="pi" textColor="neutral600">
                    Showing documents from: {selectedCollectionDocs}
                  </Typography>
                )}
              </Box>
              <Flex gap={2}>
                {selectedCollectionDocs && (
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      setSelectedCollectionDocs('');
                      fetchDocuments();
                    }}
                    size="S"
                  >
                    Show All
                  </Button>
                )}
                <Button
                  variant="secondary"
                  startIcon={<ArrowClockwise />}
                  onClick={() => {
                    if (selectedCollectionDocs) {
                      fetchCollectionDocuments(selectedCollectionDocs);
                    } else {
                      fetchDocuments();
                    }
                  }}
                  loading={documentsLoading}
                  size="S"
                >
                  Refresh
                </Button>
              </Flex>
            </Flex>

            {documentsLoading && (
              <Box padding={4} background="neutral100" hasRadius>
                <Typography variant="pi" textColor="neutral600">
                  Loading documents...
                </Typography>
              </Box>
            )}            {documents.length > 0 && !documentsLoading && (
              <Box>
                {documents.map((doc, index) => {
                  // Function to render metadata in a structured way
                  const renderMetadata = (metadata: any) => {
                    const excludeKeys = ['strapi_id', 'collection', 'indexed_at', 'title'];
                    const metadataEntries = Object.entries(metadata)
                      .filter(([key, value]) => !excludeKeys.includes(key) && value !== null && value !== undefined && value !== '')
                      .sort(([a], [b]) => a.localeCompare(b));

                    if (metadataEntries.length === 0) return null;

                    return (
                      <Box background="neutral200" hasRadius padding={2} marginTop={2}>
                        <Typography variant="pi" fontWeight="semiBold" paddingBottom={1} textColor="neutral700">
                          Metadata:
                        </Typography>
                        <Flex direction="column" gap={1}>
                          {metadataEntries.map(([key, value]) => (
                            <Flex key={key} alignItems="flex-start" gap={2}>
                              <Typography variant="pi" fontWeight="semiBold" textColor="neutral600" style={{ minWidth: '120px' }}>
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                              </Typography>
                              <Typography variant="pi" textColor="neutral700" style={{ flex: 1, wordBreak: 'break-word' }}>
                                {typeof value === 'string' && value.length > 100
                                  ? `${value.substring(0, 100)}...`
                                  : String(value)
                                }
                              </Typography>
                            </Flex>
                          ))}
                        </Flex>
                      </Box>
                    );
                  };

                  return (
                    <Card key={doc.id} padding={3} marginBottom={2} background="neutral100">
                      <Flex direction="column" gap={2}>
                        <Flex justifyContent="space-between" alignItems="flex-start">
                          <Typography variant="omega" fontWeight="semiBold">
                            {doc.metadata.title || `Document ${doc.metadata.strapi_id}`}
                          </Typography>
                          <Badge variant="secondary">
                            {doc.collection}
                          </Badge>
                        </Flex>
                        <Typography variant="pi" textColor="neutral600">
                          ID: {doc.id} | Strapi ID: {doc.metadata.strapi_id}
                        </Typography>
                        <Typography variant="pi" style={{
                          maxHeight: '80px',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {doc.document}
                        </Typography>
                        {renderMetadata(doc.metadata)}
                        <Typography variant="pi" textColor="neutral500">
                          Indexed: {new Date(doc.metadata.indexed_at).toLocaleString()}
                        </Typography>
                      </Flex>
                    </Card>
                  );
                })}
              </Box>
            )}

            {documents.length === 0 && !documentsLoading && (
              <Box padding={4} background="neutral100" hasRadius>
                <Typography variant="pi" textColor="neutral600">
                  No documents indexed yet. Try running a full sync.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {currentTab === 'export' && (
          <Box>
            <Typography variant="delta" paddingBottom={4}>
              Export Collections to Text Format
            </Typography>

            {collections.length === 0 ? (
              <Box padding={4} background="neutral100" hasRadius>
                <Typography variant="pi" textColor="neutral600">
                  No collections available for export.
                </Typography>
              </Box>
            ) : (
              <Box>
                <Box paddingBottom={4}>
                  <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
                    <Typography variant="pi" fontWeight="semiBold">
                      Select collections to export:
                    </Typography>
                    <Button
                      variant="tertiary"
                      size="S"
                      onClick={handleSelectAllCollections}
                    >
                      {selectedCollections.length === collections.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </Flex>

                  <Box background="neutral100" hasRadius padding={3}>
                    <Flex direction="column" gap={2}>
                      {collections.map((collection) => (
                        <Flex key={collection.name} alignItems="center" gap={3}>
                          <Checkbox
                            checked={selectedCollections.includes(collection.name)}
                            onCheckedChange={() => handleCollectionToggle(collection.name)}
                          />
                          <Typography variant="pi" fontWeight="semiBold">
                            {collection.name}
                          </Typography>
                          <Badge variant="secondary">
                            {collection.count} docs
                          </Badge>
                          <Typography variant="pi" textColor="neutral600">
                            Last updated: {collection.lastUpdated ? new Date(collection.lastUpdated).toLocaleDateString() : 'Never'}
                          </Typography>
                        </Flex>
                      ))}
                    </Flex>
                  </Box>
                </Box>

                <Divider paddingBottom={4} />

                <Box>
                  <Typography variant="pi" textColor="neutral600" paddingBottom={3}>
                    Export will include document content and metadata for selected collections.
                    The file will be in plain text format (.txt) and automatically downloaded.
                  </Typography>

                  <Flex gap={3}>
                    <Button
                      variant="default"
                      startIcon={<Database />}
                      onClick={handleExportCollections}
                      loading={exportLoading}
                      disabled={selectedCollections.length === 0}
                    >
                      Export Selected Collections ({selectedCollections.length})
                    </Button>

                    {selectedCollections.length > 0 && (
                      <Button
                        variant="tertiary"
                        onClick={() => setSelectedCollections([])}
                        size="S"
                      >
                        Clear Selection
                      </Button>
                    )}
                  </Flex>
                </Box>

                {exportLoading && (
                  <Box paddingTop={4}>
                    <Alert variant="default" title="Export in Progress">
                      Preparing export file... This may take a moment for large collections.
                    </Alert>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </Card>

      {/* Modal de confirmation de purge */}
      <Modal.Root open={showPurgeModal} onOpenChange={setShowPurgeModal}>
        <Modal.Content>
          <Modal.Header>
            <Typography variant="beta">Confirm Purge</Typography>
          </Modal.Header>
          <Modal.Body>
            <Typography>
              Are you sure you want to purge {selectedCollection ? `collection "${selectedCollection}"` : 'all vectors'}?
              This action cannot be undone.
            </Typography>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onClick={() => setShowPurgeModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handlePurge}
              loading={isLoading}
            >
              Purge {selectedCollection ? 'Collection' : 'All'}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      {/* Modal de statistiques détaillées */}
      <Modal.Root open={showStatsModal} onOpenChange={setShowStatsModal}>
        <Modal.Content>
          <Modal.Header>
            <Typography variant="beta">System Details</Typography>
          </Modal.Header>
          <Modal.Body>
            {stats && (
              <Box>
                <Typography variant="delta" paddingBottom={3}>Connection Status</Typography>
                <Flex direction="column" gap={2} paddingBottom={4}>
                  <Flex justifyContent="space-between">
                    <Typography>ChromaDB:</Typography>
                    <Badge variant={stats.chromaConnection ? 'success' : 'danger'}>
                      {stats.chromaConnection ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Typography>Ollama:</Typography>
                    <Badge variant={stats.ollamaConnection ? 'success' : 'danger'}>
                      {stats.ollamaConnection ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </Flex>
                </Flex>

                <Typography variant="delta" paddingBottom={3}>Statistics</Typography>
                <Flex direction="column" gap={2} paddingBottom={4}>
                  <Flex justifyContent="space-between">
                    <Typography>Total Documents:</Typography>
                    <Typography>{stats.totalDocuments || stats.document_count || 0}</Typography>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Typography>Collections:</Typography>
                    <Typography>{stats.collections?.length || stats.indexed_collections?.length || 0}</Typography>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Typography>Last Sync:</Typography>
                    <Typography>
                      {(stats.lastSync || stats.last_updated) ? new Date(stats.lastSync || stats.last_updated!).toLocaleString() : 'Never'}
                    </Typography>
                  </Flex>
                </Flex>

                <Typography variant="delta" paddingBottom={3}>Available Collections</Typography>
                <Flex direction="column" gap={1}>
                  {(stats.collections || stats.indexed_collections || []).map(collection => (
                    <Typography key={collection} variant="pi">
                      • {collection}
                    </Typography>
                  ))}
                </Flex>
              </Box>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => setShowStatsModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </Box>
  );
};

export default VectorManagementInterface;
