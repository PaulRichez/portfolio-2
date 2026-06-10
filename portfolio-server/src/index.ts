// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Seed initial : automatique si la base est VIDE (1er déploiement Coolify),
    // ou forcé via SEED_FORCE=true (utile en dev pour réappliquer les migrations,
    // ex. ajout du projet Aimi). Tout est idempotent (create-or-update par nom/titre),
    // donc relancer ne crée pas de doublons et n'écrase pas tes éditions admin
    // au-delà des champs seedés.
    try {
      const force = process.env.SEED_FORCE === 'true';
      const existing = await strapi.entityService.findMany('api::project.project', { fields: ['id'], limit: 1 });
      if (force || !existing || existing.length === 0) {
        strapi.log.info('🌱 Seed des données (base vide ou SEED_FORCE)…');
        await strapi.service('api::me.migration').populateAllData();
        strapi.log.info('✅ Seed terminé.');
      }
    } catch (e) {
      strapi.log.error('Seed initial échoué : ' + ((e as Error)?.message || e));
    }
  },
};
