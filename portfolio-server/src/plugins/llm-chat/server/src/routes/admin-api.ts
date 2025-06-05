export default [
  {
    method: 'POST',
    path: '/chat',
    handler: 'controller.chat',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/history',
    handler: 'controller.getHistory',
    config: {
      policies: [],
    },
  },
  {
    method: 'DELETE',
    path: '/history',
    handler: 'controller.clearHistory',
    config: {
      policies: [],
    },
  },
];
