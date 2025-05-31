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
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/me/populated',
      handler: 'api::me.me.findWithPopulate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
