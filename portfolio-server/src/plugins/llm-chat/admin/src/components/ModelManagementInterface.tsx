import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Table, Thead, Tbody, Tr, Th, Td, Badge, Flex } from '@strapi/design-system';
import { ArrowClockwise, ArrowUp, ArrowDown, Check } from '@strapi/icons';
import { useFetchClient } from '@strapi/strapi/admin';

const ModelManagementInterface = () => {
    const { get, put } = useFetchClient();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [providerOrder, setProviderOrder] = useState<string[]>([]);

    const fetchStats = async () => {
        try {
            setIsLoading(true);
            const { data } = await get('/llm-chat/stats');
            setStats(data);
            if (data.config?.providerOrder) {
                setProviderOrder(data.config.providerOrder);
            }
        } catch (error) {
            console.error('Failed to fetch stats', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        const newOrder = [...providerOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setProviderOrder(newOrder);

        // Save immediately
        try {
            await put('/llm-chat/config', { providerOrder: newOrder });
            fetchStats(); // Refresh to confirm
        } catch (error) {
            console.error('Failed to update config', error);
            // Revert on error could be added here
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'online':
            case 'configured':
                return <Badge active>Online</Badge>;
            case 'offline':
                return <Badge variant="danger">Offline</Badge>;
            case 'not-configured':
                return <Badge variant="warning">Not Configured</Badge>;
            default:
                return <Badge>Unknown</Badge>;
        }
    };

    return (
        <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
            <Flex justifyContent="space-between" marginBottom={4}>
                <Typography variant="beta">Model Management</Typography>
                <Button startIcon={<ArrowClockwise />} onClick={fetchStats} loading={isLoading}>
                    Refresh Status
                </Button>
            </Flex>

            <Box marginBottom={6}>
                <Typography variant="delta" marginBottom={2}>Provider Priority (Failover Order)</Typography>
                <Typography variant="pi" textColor="neutral600" marginBottom={4}>
                    The system will attempt to use providers in this order. If one fails, it moves to the next.
                </Typography>

                <Table colCount={4} rowCount={providerOrder.length}>
                    <Thead>
                        <Tr>
                            <Th><Typography variant="sigma">Priority</Typography></Th>
                            <Th><Typography variant="sigma">Provider</Typography></Th>
                            <Th><Typography variant="sigma">Status</Typography></Th>
                            <Th><Typography variant="sigma">Actions</Typography></Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {providerOrder.map((provider, index) => {
                            const providerStats = stats ? stats[provider] : {};
                            return (
                                <Tr key={provider}>
                                    <Td>
                                        <Typography variant="omega">{index + 1}</Typography>
                                    </Td>
                                    <Td>
                                        <Typography fontWeight="bold" variant="omega" style={{ textTransform: 'capitalize' }}>
                                            {provider}
                                        </Typography>
                                        {providerStats?.model && (
                                            <Typography variant="pi" textColor="neutral600">
                                                ({providerStats.model})
                                            </Typography>
                                        )}
                                    </Td>
                                    <Td>
                                        {providerStats ? getStatusBadge(providerStats.status) : <Badge>Loading...</Badge>}
                                        {providerStats?.latency > 0 && (
                                            <Typography variant="pi" marginLeft={2}>
                                                {providerStats.latency}ms
                                            </Typography>
                                        )}
                                    </Td>
                                    <Td>
                                        <Flex gap={2}>
                                            <Button
                                                onClick={() => handleMove(index, 'up')}
                                                label="Move Up"
                                                startIcon={<ArrowUp />}
                                                disabled={index === 0}
                                                variant="tertiary"
                                            />
                                            <Button
                                                onClick={() => handleMove(index, 'down')}
                                                label="Move Down"
                                                startIcon={<ArrowDown />}
                                                disabled={index === providerOrder.length - 1}
                                                variant="tertiary"
                                            />
                                        </Flex>
                                    </Td>
                                </Tr>
                            );
                        })}
                    </Tbody>
                </Table>
            </Box>

            {/* Optional: Add quota info if we had it, for now status is enough */}
        </Box>
    );
};

export default ModelManagementInterface;
