'use strict';

/**
 * Contrôleur du système de fichiers virtuel.
 * GET /api/vfs → { tree, files } pour le front (explorer + éditeur).
 */
export default ({ strapi }) => ({
  async getVfs(ctx) {
    try {
      ctx.set('Cache-Control', 'public, max-age=300');
      ctx.body = await strapi.service('api::me.vfs').getVfs();
    } catch (error) {
      strapi.log.error('VFS: génération impossible — ' + error.message);
      ctx.throw(500, `Erreur VFS: ${error.message}`);
    }
  },
});
