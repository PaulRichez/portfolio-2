import { Box, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../utils/getTranslation';
import VectorManagementInterface from '../components/VectorManagementInterface';

const VectorPage = () => {

  return (
    <VectorManagementInterface />
  );
};

export { VectorPage };
