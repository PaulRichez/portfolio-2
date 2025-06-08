#!/usr/bin/env node

/**
 * Script de test pour l'intégration ChromaDB + LangChain
 *
 * Ce script peut être exécuté pour tester que l'intégration fonctionne correctement
 *
 * Usage: node test-chroma-integration.js
 */

const { testChromaIntegration } = require('./chroma-integration-example');

// Mock Strapi pour les tests (si nécessaire)
const createMockStrapi = () => {
  return {
    log: {
      info: console.log,
      error: console.error,
      warn: console.warn
    },
    plugin: (name) => ({
      service: (serviceName) => {
        // Ici, vous devez retourner vos vrais services
        // ou créer des mocks appropriés
        console.log(`Accessing service: ${name}.${serviceName}`);
        return {};
      }
    })
  };
};

// Fonction principale
const main = async () => {
  console.log('🧪 Test de l\'intégration ChromaDB + LangChain');
  console.log('================================================');

  try {
    // Dans un vrai environnement Strapi, vous utiliseriez l'instance Strapi réelle
    // const strapi = global.strapi;

    // Pour ce test, nous utilisons un mock
    const strapi = createMockStrapi();

    await testChromaIntegration(strapi);
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  }
};

// Exécuter si ce fichier est lancé directement
if (require.main === module) {
  main();
}

module.exports = { main };
