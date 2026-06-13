/**
 * Route llms.txt — document Markdown lisible par les IA (convention llmstxt.org).
 * Servie à la racine `paulrichez.fr/llms.txt` via le proxy nginx du front.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/me/llms.txt',
      handler: 'llms.index',
      config: {
        auth: false, // public
        policies: [],
        middlewares: [],
      },
    },
  ],
};
