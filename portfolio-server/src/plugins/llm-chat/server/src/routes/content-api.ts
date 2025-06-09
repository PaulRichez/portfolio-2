export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/chat',
      handler: 'controller.chat',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/stream',
      handler: 'controller.stream',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'OPTIONS',
      path: '/stream',
      handler: 'controller.stream', // tu peux aussi utiliser une fonction vide si nécessaire
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/history',
      handler: 'controller.getHistory',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/history',
      handler: 'controller.clearHistory',
      config: {
        auth: false,
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
    {
      method: 'GET',
      path: '/sessions',
      handler: 'controller.getAllSessions',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/sessions/:sessionId',
      handler: 'controller.deleteSession',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/sessions/:sessionId/title',
      handler: 'controller.updateSessionTitle',
      config: {
        policies: [],
      },
    },
  ],
};
