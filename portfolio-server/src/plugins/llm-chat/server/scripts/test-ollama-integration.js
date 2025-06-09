#!/usr/bin/env node

/**
 * Script de test pour l'intégration Ollama avec SmartRAGTool
 * Valide que le système d'analyse IA fonctionne correctement
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const OLLAMA_URL = 'http://localhost:11434';
const QWEN_MODEL = 'qwen3:0.6b';

// Questions de test
const TEST_QUESTIONS = [
  {
    question: "Quels sont tes projets React ?",
    expectedRAG: true,
    expectedKeywords: ["projets", "React"]
  },
  {
    question: "Quel temps fait-il aujourd'hui ?",
    expectedRAG: false,
    expectedKeywords: []
  },
  {
    question: "Comment te contacter ?",
    expectedRAG: true,
    expectedKeywords: ["contact"]
  },
  {
    question: "Peux-tu me parler de ton expérience ?",
    expectedRAG: true,
    expectedKeywords: ["expérience"]
  },
  {
    question: "Que penses-tu de la politique ?",
    expectedRAG: false,
    expectedKeywords: []
  },
  {
    question: "Quelles sont tes compétences en Vue.js ?",
    expectedRAG: true,
    expectedKeywords: ["compétences", "Vue.js"]
  }
];

// Prompt pour Ollama (identique à celui du SmartRAGTool)
const createAnalysisPrompt = (userMessage) => `Tu es un système d'analyse intelligent qui détermine si une question nécessite une recherche dans une base de données de portfolio.

QUESTION À ANALYSER: "${userMessage}"

CONTEXTE: La base de données contient des informations sur :
- Projets de développement (React, Vue, PHP, etc.)
- Compétences techniques et technologies
- Expériences professionnelles
- Formation et éducation
- Informations de contact
- Portfolio personnel

TÂCHE: Détermine si cette question nécessite une recherche RAG.

RÉPONDS UNIQUEMENT au format JSON suivant :
{
  "shouldUseRAG": true/false,
  "confidence": 0.0-1.0,
  "keywords": ["mot1", "mot2"],
  "reasoning": "explication courte"
}

Exemples :
- "Quels sont tes projets React ?" → shouldUseRAG: true, keywords: ["projets", "React"]
- "Quel temps fait-il ?" → shouldUseRAG: false, keywords: []
- "Comment te contacter ?" → shouldUseRAG: true, keywords: ["contact"]`;

// Fonctions utilitaires
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Test de connexion Ollama
async function testOllamaConnection() {
  log('🔍 Test de connexion Ollama...', 'blue');

  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });

    if (response.status === 200) {
      log('✅ Ollama est accessible', 'green');

      const models = response.data.models || [];
      const qwenModel = models.find(m => m.name === QWEN_MODEL);

      if (qwenModel) {
        log(`✅ Modèle ${QWEN_MODEL} trouvé`, 'green');
        log(`   Taille: ${Math.round(qwenModel.size / 1024 / 1024)}MB`, 'cyan');
        return true;
      } else {
        log(`❌ Modèle ${QWEN_MODEL} non trouvé`, 'red');
        log('   Modèles disponibles:', 'yellow');
        models.forEach(m => log(`   - ${m.name}`, 'yellow'));
        return false;
      }
    }
  } catch (error) {
    log(`❌ Erreur de connexion Ollama: ${error.message}`, 'red');
    return false;
  }
}

// Test d'analyse avec Ollama
async function testOllamaAnalysis(question) {
  const analysisPrompt = createAnalysisPrompt(question);

  const requestBody = {
    model: QWEN_MODEL,
    prompt: analysisPrompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_ctx: 2048,
      top_p: 0.9
    }
  };

  try {
    const startTime = Date.now();

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, requestBody, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 200) {
      const ollamaResponse = response.data.response;

      // Parser la réponse JSON
      const jsonMatch = ollamaResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Aucun JSON trouvé dans la réponse Ollama');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        analysis: {
          shouldUseRAG: Boolean(analysis.shouldUseRAG),
          confidence: Math.max(0, Math.min(1, Number(analysis.confidence) || 0.5)),
          keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
          reasoning: String(analysis.reasoning || 'Analyse complétée')
        },
        responseTime,
        rawResponse: ollamaResponse
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: 0
    };
  }
}

// Validation des résultats
function validateAnalysis(analysis, expected, question) {
  const issues = [];

  // Vérifier la décision RAG
  if (analysis.shouldUseRAG !== expected.expectedRAG) {
    issues.push(`RAG décision incorrecte: attendu ${expected.expectedRAG}, reçu ${analysis.shouldUseRAG}`);
  }

  // Vérifier la présence de mots-clés attendus (souple)
  if (expected.expectedRAG && expected.expectedKeywords.length > 0) {
    const hasExpectedKeywords = expected.expectedKeywords.some(keyword =>
      analysis.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
    );

    if (!hasExpectedKeywords) {
      issues.push(`Mots-clés manquants: attendus ${expected.expectedKeywords.join(', ')}, reçus ${analysis.keywords.join(', ')}`);
    }
  }

  // Vérifier la confiance
  if (analysis.confidence < 0.5) {
    issues.push(`Confiance faible: ${(analysis.confidence * 100).toFixed(1)}%`);
  }

  return issues;
}

// Test principal
async function runTests() {
  log('🧪 Test de l\'intégration Ollama - SmartRAGTool', 'bright');
  log('='.repeat(60), 'cyan');

  // Test de connexion
  const connectionOk = await testOllamaConnection();
  if (!connectionOk) {
    log('❌ Tests annulés: Ollama non accessible', 'red');
    process.exit(1);
  }

  log(''); // Ligne vide

  // Tests d'analyse
  let successCount = 0;
  let totalResponseTime = 0;
  const results = [];

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const test = TEST_QUESTIONS[i];
    log(`📝 Test ${i + 1}/${TEST_QUESTIONS.length}: "${test.question}"`, 'blue');

    const result = await testOllamaAnalysis(test.question);

    if (result.success) {
      const issues = validateAnalysis(result.analysis, test, test.question);
      totalResponseTime += result.responseTime;

      if (issues.length === 0) {
        log(`✅ Succès (${result.responseTime}ms)`, 'green');
        log(`   RAG: ${result.analysis.shouldUseRAG} | Confiance: ${(result.analysis.confidence * 100).toFixed(1)}%`, 'cyan');
        log(`   Mots-clés: [${result.analysis.keywords.join(', ')}]`, 'cyan');
        log(`   Raison: ${result.analysis.reasoning}`, 'cyan');
        successCount++;
      } else {
        log(`⚠️  Problème (${result.responseTime}ms)`, 'yellow');
        log(`   RAG: ${result.analysis.shouldUseRAG} | Confiance: ${(result.analysis.confidence * 100).toFixed(1)}%`, 'cyan');
        log(`   Mots-clés: [${result.analysis.keywords.join(', ')}]`, 'cyan');
        issues.forEach(issue => log(`   ⚠️  ${issue}`, 'yellow'));
      }

      results.push({
        question: test.question,
        success: issues.length === 0,
        analysis: result.analysis,
        responseTime: result.responseTime,
        issues
      });
    } else {
      log(`❌ Échec: ${result.error}`, 'red');
      results.push({
        question: test.question,
        success: false,
        error: result.error,
        responseTime: 0
      });
    }

    log(''); // Ligne vide entre les tests
  }

  // Résumé
  log('📊 Résumé des Tests', 'bright');
  log('='.repeat(60), 'cyan');
  log(`Tests réussis: ${successCount}/${TEST_QUESTIONS.length}`, successCount === TEST_QUESTIONS.length ? 'green' : 'yellow');
  log(`Temps moyen de réponse: ${Math.round(totalResponseTime / TEST_QUESTIONS.length)}ms`, 'cyan');
  log(`Taux de succès: ${Math.round((successCount / TEST_QUESTIONS.length) * 100)}%`, 'cyan');

  // Sauvegarder les résultats
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, `test-results-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    model: QWEN_MODEL,
    totalTests: TEST_QUESTIONS.length,
    successCount,
    successRate: (successCount / TEST_QUESTIONS.length) * 100,
    averageResponseTime: Math.round(totalResponseTime / TEST_QUESTIONS.length),
    results
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`📄 Rapport sauvegardé: ${reportPath}`, 'magenta');

  // Recommandations
  if (successCount < TEST_QUESTIONS.length) {
    log('', 'reset');
    log('💡 Recommandations:', 'yellow');
    log('   - Vérifier la qualité du prompt d\'analyse', 'yellow');
    log('   - Ajuster la température du modèle', 'yellow');
    log('   - Considérer un fine-tuning pour ce cas d\'usage', 'yellow');
  } else {
    log('🎉 Tous les tests sont réussis ! L\'intégration Ollama fonctionne parfaitement.', 'green');
  }
}

// Exécution
if (require.main === module) {
  runTests().catch(error => {
    log(`💥 Erreur fatale: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testOllamaConnection, testOllamaAnalysis, validateAnalysis };
