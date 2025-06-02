import React from 'react';
import { Box, Typography, Button } from '@strapi/design-system';

const SimpleChatTest = () => {
  return (
    <Box padding={4} background="neutral100">
      <Typography variant="beta">Simple Chat Test</Typography>
      <Box paddingTop={4}>
        <Button>Click me</Button>
      </Box>
    </Box>
  );
};

export default SimpleChatTest;
