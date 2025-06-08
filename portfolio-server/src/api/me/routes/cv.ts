/**
 * Routes pour le CV
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/me/cv',
      handler: 'cv.generateCv',
      config: {
        auth: false, // Accessible sans authentification
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/me/cv/download',
      handler: 'cv.downloadCv',
      config: {
        auth: false, // Accessible sans authentification
        policies: [],
        middlewares: [],
      },
    }
  ]
};
