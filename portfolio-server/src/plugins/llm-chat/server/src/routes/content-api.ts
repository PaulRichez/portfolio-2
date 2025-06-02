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
];
