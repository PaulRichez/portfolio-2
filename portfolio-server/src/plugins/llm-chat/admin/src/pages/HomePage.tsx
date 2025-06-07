import { Box, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Information } from '@strapi/icons';

import { getTranslation } from '../utils/getTranslation';
import ChatInterface from '../components/ChatInterface';

const HomePage = () => {
  const { formatMessage } = useIntl();

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
      <ChatInterface
        defaultSystemPrompt="You are a helpful assistant for the website administrator. Provide concise and accurate information."
      />
    </Box>
  );
};

export { HomePage };
