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
    // Seed automatique à CHAQUE démarrage (donc à chaque déploiement Coolify).
    // Tout est idempotent : upsert du single type `me` (la photo uploadée en admin
    // est préservée, elle n'est pas dans le payload) + create-or-update des projets
    // par titre. Le contenu de référence vit dans le code (migration.ts) et se
    // resynchronise tout seul — aucun SEED_FORCE à gérer.
    // ⚠️ Conséquence : les champs seedés sont pilotés par le code ; une édition de
    // ces champs faite dans l'admin sera ré-appliquée depuis le code au prochain
    // déploiement (les médias comme la photo, eux, ne sont jamais touchés).
    try {
      strapi.log.info('🌱 Synchronisation du contenu (seed idempotent)…');
      await strapi.service('api::me.migration').populateAllData();
      strapi.log.info('✅ Contenu à jour.');
    } catch (e) {
      strapi.log.error('Seed échoué : ' + ((e as Error)?.message || e));
    }
  },
};
