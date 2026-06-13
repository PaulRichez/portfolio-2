/**
 * Route sitemap.xml — généré depuis le VFS. Servie à la racine
 * `paulrichez.fr/sitemap.xml` via le proxy nginx du front.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/me/sitemap.xml',
      handler: 'sitemap.index',
      config: {
        auth: false, // public
        policies: [],
        middlewares: [],
      },
    },
  ],
};
