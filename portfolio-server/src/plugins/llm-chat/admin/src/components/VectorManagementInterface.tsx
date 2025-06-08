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
  Divider
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
  Cog
} from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useFetchClient } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';

interface VectorStats {
  totalDocuments: number;
  collections: string[];
  lastSync: string;
  health: 'healthy' | 'warning' | 'error';
  chromaConnection: boolean;
  ollamaConnection: boolean;
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
      fetchCollections()
    ]);
  };

  const fetchStats = async () => {
    try {
      const response = await get(`/${PLUGIN_ID}/vectors/stats`) as any;
      if (response?.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch vector stats:', err);
      setError(err.message || 'Failed to fetch stats');
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

  const testConnections = async () => {
    setIsLoading(true);
    try {
      const response = await post(`/${PLUGIN_ID}/vectors/test-connection`, {}) as any;
      if (response?.data) {
        setStats(prev => prev ? { ...prev, ...response.data } : response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
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
                {stats?.totalDocuments || 0}
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
                {stats?.collections?.length || 0}
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

      {/* Vector Search */}
      <Card padding={4}>
        <Typography variant="beta" paddingBottom={4}>Vector Search</Typography>
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
        </Flex>

        {searchResults.length > 0 && (
          <Box>
            <Typography variant="delta" paddingBottom={3}>
              Search Results ({searchResults.length})
            </Typography>
            {searchResults.map((result, index) => (
              <Card key={result.id} padding={3} marginBottom={2} background="neutral100">
                <Flex direction="column" gap={2}>
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="omega" fontWeight="semiBold">
                      {result.metadata.title || result.metadata.collection}
                    </Typography>
                    <Badge>
                      Score: {(1 - result.distance).toFixed(3)}
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
                </Flex>
              </Card>
            ))}
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
                    <Typography>{stats.totalDocuments}</Typography>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Typography>Collections:</Typography>
                    <Typography>{stats.collections.length}</Typography>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Typography>Last Sync:</Typography>
                    <Typography>
                      {stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}
                    </Typography>
                  </Flex>
                </Flex>

                <Typography variant="delta" paddingBottom={3}>Available Collections</Typography>
                <Flex direction="column" gap={1}>
                  {stats.collections.map(collection => (
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
