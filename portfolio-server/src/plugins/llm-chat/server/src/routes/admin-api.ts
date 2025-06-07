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
    method: 'GET',
    path: '/sessions',
    handler: 'controller.getAllSessions',
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
  {
    method: 'DELETE',
    path: '/history/all',
    handler: 'controller.clearAllHistory',
    config: {
      policies: [],
    },
  },
];
