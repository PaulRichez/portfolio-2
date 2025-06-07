export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/chat',
      handler: 'controller.chat',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/stream',
      handler: 'controller.stream',
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
