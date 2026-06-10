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
    // Seed automatique à chaque démarrage, mais en ARRIÈRE-PLAN : on ne bloque JAMAIS
    // le boot de Strapi. Sinon, sur une machine chargée, un seed lent retarde la
    // réponse à /_health → le healthcheck échoue → Coolify redémarre → restart-loop
    // qui sature la box. Ici l'API devient prête tout de suite ; le contenu se
    // synchronise juste après (idempotent : upsert `me` photo préservée + projets).
    // Conséquence inchangée : les champs seedés sont pilotés par le code (réappliqués
    // au déploiement) ; les médias comme la photo ne sont jamais touchés.
    const runSeed = async () => {
      try {
        strapi.log.info('🌱 Synchronisation du contenu (seed idempotent)…');
        await strapi.service('api::me.migration').populateAllData();
        strapi.log.info('✅ Contenu à jour.');
      } catch (e) {
        strapi.log.error('Seed échoué : ' + ((e as Error)?.message || e));
      }
    };
    setTimeout(() => void runSeed(), 2000); // après le démarrage, sans bloquer le boot
  },
};
