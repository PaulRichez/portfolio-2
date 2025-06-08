'use strict';

/**
 * me router
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/me',
      handler: 'api::me.me.find',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/me/populated',
      handler: 'api::me.me.findWithPopulate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
