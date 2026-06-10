'use strict';

export default {
  routes: [
    { method: 'POST', path: '/chat/stream', handler: 'chat.stream', config: { auth: false, policies: [], middlewares: [] } },
    { method: 'GET', path: '/chat/history', handler: 'chat.history', config: { auth: false, policies: [], middlewares: [] } },
    { method: 'DELETE', path: '/chat/history', handler: 'chat.clear', config: { auth: false, policies: [], middlewares: [] } },
  ],
};
