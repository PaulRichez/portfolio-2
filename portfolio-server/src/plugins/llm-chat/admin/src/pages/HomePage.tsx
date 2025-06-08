import { Box, Typography, Tabs } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { useNavigate, useLocation } from 'react-router-dom';
import { Information, Database, Message } from '@strapi/icons';

import { getTranslation } from '../utils/getTranslation';
import ChatInterface from '../components/ChatInterface';
import VectorManagementInterface from '../components/VectorManagementInterface';

const HomePage = () => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname.includes('/vectors') ? 1 : 0;

  const handleTabChange = (tab: number) => {
    if (tab === 0) {
      navigate('.');
    } else {
      navigate('./vectors');
    }
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
      </Tabs.Root>
    </Box>
  );
};

export { HomePage };
