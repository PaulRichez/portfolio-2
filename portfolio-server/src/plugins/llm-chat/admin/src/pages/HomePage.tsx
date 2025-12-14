import React, { useState } from 'react';
import { Box, Typography, Tabs } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Information, Database, Message, Cog } from '@strapi/icons';

import { getTranslation } from '../utils/getTranslation';
import ChatInterface from '../components/ChatInterface';
import VectorManagementInterface from '../components/VectorManagementInterface';
import ModelManagementInterface from '../components/ModelManagementInterface';

const HomePage = () => {
  const { formatMessage } = useIntl();
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (tab: number) => {
    setCurrentTab(tab);
  };

  return (
    <Box padding={6}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">
          {formatMessage({ id: getTranslation('plugin.name') })}
        </Typography>
        <Typography variant="epsilon" textColor="neutral600">
          {formatMessage({ id: getTranslation('plugin.description') })}
        </Typography>
      </Box>

      <Tabs.Root value={currentTab} onValueChange={handleTabChange}>
        <Tabs.List aria-label="LLM Chat Plugin Features">
          <Tabs.Trigger value={0}>
            <Message />
            Chat Interface
          </Tabs.Trigger>
          <Tabs.Trigger value={1}>
            <Database />
            Vector RAG
          </Tabs.Trigger>
          <Tabs.Trigger value={2}>
            <Cog />
            Models
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value={0}>
          <Box paddingTop={4}>
            <ChatInterface
              defaultSystemPrompt="You are a helpful assistant for the website administrator. Provide concise and accurate information."
            />
          </Box>
        </Tabs.Content>

        <Tabs.Content value={1}>
          <Box paddingTop={4}>
            <VectorManagementInterface />
          </Box>
        </Tabs.Content>

        <Tabs.Content value={2}>
          <Box paddingTop={4}>
            <ModelManagementInterface />
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
};

export { HomePage };
