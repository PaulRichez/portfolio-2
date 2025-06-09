#!/usr/bin/env node

/**
 * Script utilitaire pour vérifier rapidement l'état de l'intégration Ollama
 */

const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';
const QWEN_MODEL = 'qwen3:0.6b';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function quickCheck() {
  log('🔍 Vérification rapide de l\'intégration Ollama...', 'blue');

  try {
    // Test connexion
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });

    if (response.status === 200) {
      log('✅ Ollama connecté', 'green');

      const models = response.data.models || [];
      const qwenModel = models.find(m => m.name === QWEN_MODEL);

      if (qwenModel) {
        log(`✅ Modèle ${QWEN_MODEL} disponible (${Math.round(qwenModel.size / 1024 / 1024)}MB)`, 'green');

        // Test rapide d'analyse
        const testPrompt = 'Tu es un système d\'analyse. Réponds juste "OK" pour confirmer que tu fonctionnes.';

        const analysisStart = Date.now();
        const analysisResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: QWEN_MODEL,
          prompt: testPrompt,
          stream: false,
          options: { temperature: 0.1, num_ctx: 512 }
        }, { timeout: 5000 });

        const analysisTime = Date.now() - analysisStart;

        if (analysisResponse.status === 200) {
          log(`✅ Modèle fonctionnel (${analysisTime}ms)`, 'green');
          log('🎉 Intégration Ollama opérationnelle !', 'green');
          return true;
        } else {
          log(`❌ Erreur de génération: ${analysisResponse.status}`, 'red');
          return false;
        }
      } else {
        log(`❌ Modèle ${QWEN_MODEL} introuvable`, 'red');
        log('Modèles disponibles:', 'yellow');
        models.forEach(m => log(`  - ${m.name}`, 'yellow'));

        log('\n💡 Pour installer le modèle manquant:', 'cyan');
        log(`docker exec portfolio-ollama ollama pull ${QWEN_MODEL}`, 'cyan');
        return false;
      }
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Ollama non accessible - serveur arrêté ?', 'red');
      log('\n💡 Pour démarrer Ollama:', 'cyan');
      log('docker-compose up ollama -d', 'cyan');
    } else if (error.code === 'ENOTFOUND') {
      log('❌ Ollama non trouvé - vérifiez l\'URL', 'red');
    } else {
      log(`❌ Erreur: ${error.message}`, 'red');
    }
    return false;
  }
}

if (require.main === module) {
  quickCheck().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { quickCheck };
