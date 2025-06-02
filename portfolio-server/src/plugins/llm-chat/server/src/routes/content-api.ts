export default [
  {
    method: 'GET',
    path: '/',
    handler: 'controller.index',
    config: {
      policies: [],
    },
  },
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
