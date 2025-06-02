import { Main, Box, Typography, ContentLayout, HeaderLayout } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Information } from '@strapi/icons';

import { getTranslation } from '../utils/getTranslation';
import ChatInterface from '../components/ChatInterface';

const HomePage = () => {
  const { formatMessage } = useIntl();

  return (
    <Main>
      <HeaderLayout
        title={formatMessage({ id: getTranslation('plugin.name') })}
        subtitle={formatMessage({ id: getTranslation('plugin.description') })}
        primaryAction={null}
      />
      <ContentLayout>
        <Box paddingTop={6} paddingBottom={6}>
          <ChatInterface
            defaultSystemPrompt="You are a helpful assistant for the website administrator. Provide concise and accurate information."
          />
        </Box>
      </ContentLayout>
    </Main>
  );
};

export { HomePage };
