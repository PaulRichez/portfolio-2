'use strict';

/**
 * Contrôleur pour la génération du CV
 */
export default ({ strapi }) => ({
  
  /**
   * Génère et retourne le CV en PDF
   */
  async generateCv(ctx) {
    try {
      console.log('🎯 Génération du CV demandée');
      
      // Générer le PDF
      const pdfStream = await strapi.service('api::me.cv').generateCvPdf();
      
      // Configuration des headers pour le PDF
      ctx.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="CV-Paul-Richez.pdf"',
        'Cache-Control': 'no-cache'
      });
      
      // Streamer le PDF directement vers la réponse
      ctx.body = pdfStream;
      ctx.respond = false; // Indiquer à Koa de ne pas traiter automatiquement la réponse
      
      // Écrire le stream dans la réponse
      pdfStream.pipe(ctx.res);
      
      // Finaliser le PDF
      pdfStream.end();
      
    } catch (error) {
      console.error('❌ Erreur lors de la génération du CV:', error);
      ctx.throw(500, `Erreur lors de la génération du CV: ${error.message}`);
    }
  },

  /**
   * Télécharge le CV en PDF
   */
  async downloadCv(ctx) {
    try {
      console.log('📥 Téléchargement du CV demandé');
      
      // Générer le PDF
      const pdfStream = await strapi.service('api::me.cv').generateCvPdf();
      
      // Configuration des headers pour le téléchargement
      ctx.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="CV-Paul-Richez.pdf"',
        'Cache-Control': 'no-cache'
      });
      
      // Streamer le PDF directement vers la réponse
      ctx.body = pdfStream;
      ctx.respond = false;
      
      // Écrire le stream dans la réponse
      pdfStream.pipe(ctx.res);
      
      // Finaliser le PDF
      pdfStream.end();
      
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement du CV:', error);
      ctx.throw(500, `Erreur lors du téléchargement du CV: ${error.message}`);
    }
  }
});
