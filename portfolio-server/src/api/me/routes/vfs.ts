'use strict';

export default {
  routes: [
    {
      method: 'GET',
      path: '/vfs',
      handler: 'vfs.getVfs',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
