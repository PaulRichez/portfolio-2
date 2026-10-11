'use strict';

export default {
  routes: [
    { method: 'POST', path: '/chat/agent', handler: 'chat.agent', config: { auth: false, policies: [], middlewares: [] } },
    { method: 'POST', path: '/chat/suggestions', handler: 'chat.suggestions', config: { auth: false, policies: [], middlewares: [] } },
  ],
};
