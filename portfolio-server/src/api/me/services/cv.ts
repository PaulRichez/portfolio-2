'use strict';

const ReactPDF = require('@react-pdf/renderer');
const path = require('path');
const { buildCvDocument, prepareCvPhoto } = require('./cv-document');

/**
 * Service de génération du CV en PDF (moteur @react-pdf/renderer).
 * Le design vit dans `cv-document.ts` (module pur, testable).
 */
export default ({ strapi }) => ({

  /** Génère le CV et retourne un stream PDF. */
  async generateCvPdf() {
    const meData: any = await this.getCvData();
    if (!meData) {
      throw new Error('Aucune donnée CV trouvée');
    }
    // Résoudre la photo en chemin absolu pour react-pdf.
    // Priorité : media uploadé dans l'admin → sinon photo par défaut bundlée (public/cv-photo.jpg).
    try {
      const publicDir = (strapi as any).dirs?.static?.public || path.join(process.cwd(), 'public');
      const url = meData.photo?.url;
      meData._photoSrc = url ? path.join(publicDir, url) : path.join(publicDir, 'cv-photo.jpg');
      meData._photoPng = await prepareCvPhoto(meData._photoSrc); // détourage net (sharp)
    } catch (e) {
      strapi.log.warn('CV: photo introuvable — ' + (e as Error).message);
    }
    return await ReactPDF.renderToStream(buildCvDocument(meData));
  },

  /** Récupère les données du CV depuis Strapi. */
  async getCvData() {
    return await strapi.entityService.findMany('api::me.me', {
      populate: {
        photo: true,
        languages: true,
        diplomas: true,
        experiences: true,
        coding_skills: { populate: { coding: true } },
      },
    });
  },
});
