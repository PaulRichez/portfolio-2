'use strict';

/**
 * Contrôleur pour la génération du CV PDF.
 * Le service renvoie un stream Node ; Koa le pipe directement via ctx.body.
 */
export default ({ strapi }) => ({

  /** Affiche le CV en PDF (inline dans le navigateur). */
  async generateCv(ctx) {
    try {
      const stream = await strapi.service('api::me.cv').generateCvPdf();
      ctx.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="CV-Paul-Richez.pdf"',
        'Cache-Control': 'no-cache',
      });
      ctx.body = stream;
    } catch (error) {
      console.error('❌ Erreur lors de la génération du CV:', error);
      ctx.throw(500, `Erreur lors de la génération du CV: ${error.message}`);
    }
  },

  /** Télécharge le CV en PDF (attachment). */
  async downloadCv(ctx) {
    try {
      const stream = await strapi.service('api::me.cv').generateCvPdf();
      ctx.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="CV-Paul-Richez.pdf"',
        'Cache-Control': 'no-cache',
      });
      ctx.body = stream;
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement du CV:', error);
      ctx.throw(500, `Erreur lors du téléchargement du CV: ${error.message}`);
    }
  },
});
