import { Tool } from "@langchain/core/tools";
import type { Core } from '@strapi/strapi';

/**
 * Outil LangChain intelligent qui utilise Ollama qwen3:0.6b pour décider automatiquement quand utiliser le RAG
 * Cet outil analyse le message de l'utilisateur avec IA et détermine s'il nécessite
 * une recherche dans ChromaDB, puis effectue la recherche si nécessaire
 */
export class SmartRAGTool extends Tool {
  name = "smart_rag_search";
  description = `Outil intelligent de PaulIA qui utilise Ollama qwen3:0.6b pour analyser automatiquement si une question
  nécessite une recherche dans la base de données du portfolio de Paul et effectue la recherche appropriée.

  PaulIA utilise cet outil pour :
  - Analyser la pertinence des questions sur le profil de Paul
  - Déterminer automatiquement si une recherche dans ses données est nécessaire
  - Extraire les mots-clés optimaux pour trouver les bonnes informations
  - Adapter le nombre de résultats selon le contexte de la question
  - Formater intelligemment les informations sur Paul

  Particulièrement efficace pour répondre aux questions sur :
  - Les projets développés par Paul (technologies, réalisations, démos)
  - Ses compétences techniques et son expertise
  - Son parcours professionnel et ses expériences
  - Sa formation et son background
  - Ses informations de contact et liens professionnels

  Paramètre d'entrée : la question du visiteur sur Paul (string)

  PaulIA décide automatiquement :
  1. Si la question nécessite d'accéder aux données de Paul (avec niveau de confiance)
  2. Quels mots-clés utiliser pour trouver les bonnes informations
  3. Combien d'éléments récupérer pour répondre complètement
  4. Comment présenter les informations de manière engageante

  Exemples d'utilisation par PaulIA :
  - "Quels sont les projets React de Paul ?" → IA détecte: données nécessaires, mots-clés: ["projets", "React"]
  - "Quel temps fait-il ?" → IA détecte: données non nécessaires (hors sujet Paul)
  - "Comment contacter Paul ?" → IA détecte: données nécessaires, mots-clés: ["contact"]
  - "Parle-moi de l'expérience de Paul ?" → IA détecte: données nécessaires, mots-clés: ["expérience"]`;

  private strapi: Core.Strapi;
  private chromaService: any;
  private ollamaService: any;

  constructor(strapi: Core.Strapi) {
    super();
    this.strapi = strapi;
    this.chromaService = strapi.plugin('llm-chat').service('chromaVectorService');
    this.ollamaService = strapi.plugin('llm-chat').service('ollamaService');
  }

  /**
   * Utilise Ollama qwen3:0.6b pour analyser si le message nécessite une recherche RAG
   * Remplace la logique manuelle par une analyse IA intelligente
   */
  private async analyzeWithOllama(message: string): Promise<{
    shouldUseRAG: boolean;
    confidence: number;
    keywords: string[];
    reasoning: string;
  }> {
    try {
      return await this.ollamaService.shouldUseRAGWithOllama(message);
    } catch (error) {
      this.strapi.log.error('❌ Ollama analysis failed, using fallback:', error);

      // Fallback à l'analyse manuelle
      const shouldUseRAG = this.shouldUseRAGFallback(message);
      return {
        shouldUseRAG,
        confidence: 0.7,
        keywords: shouldUseRAG ? this.extractKeywordsFallback(message) : [],
        reasoning: `Fallback analysis used (Ollama error: ${error.message})`
      };
    }
  }

  /**
   * Méthode de fallback pour l'analyse manuelle (utilisée si Ollama échoue)
   */
  private shouldUseRAGFallback(message: string): boolean {
    const portfolioKeywords = [
      // Projets et réalisations
      'projet', 'projects', 'réalisation', 'réalisations', 'portfolio',
      'développé', 'développement', 'créé', 'construit', 'built', 'created',

      // Compétences et technologies
      'compétence', 'compétences', 'skills', 'skill', 'technologie', 'technologies',
      'maîtrise', 'maîtrises', 'connaissances', 'language', 'langages',

      // Technologies spécifiques
      'react', 'vue', 'angular', 'nodejs', 'node', 'php', 'python', 'javascript',
      'typescript', 'html', 'css', 'bootstrap', 'tailwind', 'sass', 'scss',
      'mysql', 'mongodb', 'postgresql', 'firebase', 'aws', 'docker',
      'api', 'rest', 'graphql', 'strapi', 'wordpress', 'laravel',

      // Expériences et formation
      'expérience', 'expériences', 'experience', 'experiences', 'travail', 'job',
      'formation', 'formations', 'education', 'étude', 'études', 'diplôme', 'diplômes',
      'université', 'école', 'cursus', 'parcours',

      // Informations personnelles
      'qui es-tu', 'qui êtes-vous', 'présente-toi', 'présentez-vous',
      'présente', 'about', 'à propos', 'cv', 'profil', 'profile',
      'paul', 'nom', 'prénom', 'âge', 'age',

      // Contact et liens
      'contact', 'contacter', 'joindre', 'email', 'mail', 'téléphone', 'phone',
      'coordonnées', 'github', 'linkedin', 'site', 'website', 'portfolio',

      // Types de développement
      'web', 'mobile', 'frontend', 'backend', 'fullstack', 'full-stack',
      'développeur', 'developer', 'programmeur', 'programmer',

      // Questions générales sur la personne
      'toi', 'vous', 'ton', 'votre', 'tes', 'vos'
    ];

    const lowerMessage = message.toLowerCase();
    return portfolioKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Méthode de fallback pour extraire les mots-clés (utilisée si Ollama échoue)
   */
  private extractKeywordsFallback(message: string): string[] {
    const lowerMessage = message.toLowerCase();

    // Mots-clés spécifiques à rechercher en priorité
    const techKeywords = [
      'react', 'vue', 'angular', 'nodejs', 'php', 'python', 'javascript',
      'typescript', 'html', 'css', 'bootstrap', 'tailwind', 'mysql', 'mongodb'
    ];

    const contextKeywords = [
      'projet', 'projects', 'compétence', 'skills', 'expérience', 'experience',
      'formation', 'education', 'contact', 'portfolio'
    ];

    // Chercher les technologies mentionnées
    const foundTech = techKeywords.filter(tech => lowerMessage.includes(tech));

    // Chercher les contextes mentionnés
    const foundContext = contextKeywords.filter(context => lowerMessage.includes(context));

    return [...foundContext, ...foundTech];
  }

  /**
   * Construit la requête de recherche optimale à partir des mots-clés
   */
  private buildSearchQuery(keywords: string[]): string {
    if (keywords.length === 0) {
      return '';
    }

    // Prioriser les mots-clés contextuels et techniques
    const contextualWords = keywords.filter(k => ['projet', 'projects', 'compétence', 'skills', 'expérience', 'experience', 'formation', 'education', 'contact'].includes(k));
    const technicalWords = keywords.filter(k => ['react', 'vue', 'angular', 'nodejs', 'php', 'python', 'javascript', 'typescript'].includes(k));

    if (contextualWords.length > 0 && technicalWords.length > 0) {
      return `${contextualWords[0]} ${technicalWords.join(' ')}`;
    } else if (technicalWords.length > 0) {
      return technicalWords.join(' ');
    } else if (contextualWords.length > 0) {
      return contextualWords[0];
    } else {
      return keywords.join(' ');
    }
  }

  /**
   * Détermine le nombre optimal de résultats à récupérer basé sur l'analyse Ollama
   */
  private getOptimalResultCount(message: string, keywords: string[]): number {
    const lowerMessage = message.toLowerCase();

    // Questions très spécifiques → moins de résultats
    if (lowerMessage.includes('contact') || lowerMessage.includes('téléphone') || lowerMessage.includes('email')) {
      return 2;
    }

    // Questions générales → plus de résultats
    if (lowerMessage.includes('tout') || lowerMessage.includes('tous') || lowerMessage.includes('liste')) {
      return 8;
    }

    // Selon le nombre de mots-clés
    if (keywords.length > 3) {
      return 6;
    } else if (keywords.length > 1) {
      return 4;
    }

    // Par défaut
    return 5;
  }

  /**
   * Formate les résultats ChromaDB pour PaulIA avec informations de l'analyse IA
   */
  private formatChromaResults(
    results: any[],
    originalQuery: string,
    searchQuery: string,
    analysis: { confidence: number; reasoning: string }
  ): string {
    if (!results || results.length === 0) {
      return `PaulIA n'a pas trouvé d'informations spécifiques pour "${originalQuery}". Recherche effectuée avec : "${searchQuery}". Je peux quand même t'aider avec mes connaissances générales sur Paul !`;
    }

    const sections: string[] = [];
    sections.push(`=== 🤖 PaulIA - Recherche intelligente pour "${originalQuery}" ===`);
    sections.push(`🎯 Analyse effectuée avec : "${searchQuery}"`);
    sections.push(`🧠 Confiance IA : ${(analysis.confidence * 100).toFixed(1)}% - ${analysis.reasoning}`);
    sections.push('');

    results.forEach((result, index) => {
      const metadata = result.metadata || {};
      const collection = metadata.collection || 'unknown';
      const similarity = (1 - result.distance).toFixed(3);

      sections.push(`${index + 1}. ${this.getCollectionDisplayName(collection)} (Pertinence: ${similarity})`);
      sections.push(`   ${result.document.trim()}`);

      // Ajouter des métadonnées pertinentes
      const relevantMetadata = this.extractRelevantMetadata(metadata);
      if (relevantMetadata.length > 0) {
        sections.push(`   📋 Détails: ${relevantMetadata.join(', ')}`);
      }

      sections.push(''); // Ligne vide entre les résultats
    });

    sections.push(`=== ✅ ${results.length} élément${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''} sur Paul ===`);
    sections.push('💡 PaulIA utilise ces informations pour te répondre précisément.');

    return sections.join('\n');
  }

  /**
   * Convertit les noms de collection en noms d'affichage
   */
  private getCollectionDisplayName(collection: string): string {
    const displayNames: Record<string, string> = {
      'api::project.project': '📁 Projet',
      'api::me.me': '👤 Profil personnel',
      'api::coding.coding': '💻 Technologie',
      'api::article.article': '📝 Article',
      'api::faq.faq': '❓ FAQ',
      'api::experience.experience': '💼 Expérience',
      'api::education.education': '🎓 Formation'
    };

    return displayNames[collection] || `📄 ${collection}`;
  }

  /**
   * Extrait les métadonnées pertinentes
   */
  private extractRelevantMetadata(metadata: any): string[] {
    const relevant: string[] = [];

    if (metadata.github_link) relevant.push(`GitHub: ${metadata.github_link}`);
    if (metadata.link_demo) relevant.push(`Démo: ${metadata.link_demo}`);
    if (metadata.link_npm) relevant.push(`NPM: ${metadata.link_npm}`);
    if (metadata.email) relevant.push(`Email: ${metadata.email}`);
    if (metadata.phoneNumber) relevant.push(`Tél: ${metadata.phoneNumber}`);
    if (metadata.website) relevant.push(`Site: ${metadata.website}`);
    if (metadata.linkedin) relevant.push(`LinkedIn: ${metadata.linkedin}`);
    if (metadata.github) relevant.push(`GitHub: ${metadata.github}`);
    if (metadata.codings_names) relevant.push(`Technologies: ${metadata.codings_names}`);
    if (metadata.coding_skills_names) relevant.push(`Compétences: ${metadata.coding_skills_names}`);
    if (metadata.category) relevant.push(`Catégorie: ${metadata.category}`);
    if (metadata.languages) {
      const languageLabels = metadata.languages.split(', ').map(lang => {
        const [code, percentage] = lang.split(':');
        const level = this.getLanguageLevelLabel(parseInt(percentage));
        return `${code} (${level})`;
      }).join(', ');
      relevant.push(`Langues: ${languageLabels}`);
    }

    return relevant;
  }

  /**
   * Convertit un pourcentage en niveau de langue
   */
  private getLanguageLevelLabel(percentage: number): string {
    if (percentage >= 95) return 'Langue maternelle';
    if (percentage >= 85) return 'Courant';
    if (percentage >= 70) return 'Avancé';
    if (percentage >= 50) return 'Intermédiaire';
    if (percentage >= 30) return 'Débutant';
    return 'Notions';
  }

  /**
   * Exécute l'analyse intelligente avec Ollama et la recherche RAG si nécessaire
   */
  async _call(input: string): Promise<string> {
    try {
      this.strapi.log.info('🤖 PaulIA SmartRAGTool: Starting AI analysis with Ollama qwen3:0.6b');

      // 1. Analyser avec Ollama si le RAG est nécessaire
      const analysis = await this.analyzeWithOllama(input);

      this.strapi.log.info('🧠 Ollama analysis result:', {
        shouldUseRAG: analysis.shouldUseRAG,
        confidence: analysis.confidence,
        keywords: analysis.keywords,
        reasoning: analysis.reasoning
      });

      if (!analysis.shouldUseRAG) {
        this.strapi.log.info('ℹ️ PaulIA: AI determined no database search needed');
        return `PaulIA a déterminé que cette question ne nécessite pas de recherche dans les données de Paul (confiance: ${(analysis.confidence * 100).toFixed(1)}%). Raison: ${analysis.reasoning}`;
      }

      // 2. Construire la requête de recherche à partir des mots-clés IA
      const searchQuery = this.buildSearchQuery(analysis.keywords);
      this.strapi.log.info('🎯 SmartRAGTool: AI-generated search query:', searchQuery);

      // 3. Déterminer le nombre optimal de résultats
      const resultCount = this.getOptimalResultCount(input, analysis.keywords);

      // 4. Effectuer la recherche ChromaDB
      const searchTimerId = `🔍 SmartRAG AI Search`;
      console.time(searchTimerId);

      const searchResults = await this.chromaService.searchDocuments(searchQuery, resultCount);

      console.timeEnd(searchTimerId);

      // 5. Formater et retourner les résultats avec l'analyse IA
      if (!searchResults || searchResults.length === 0) {
        this.strapi.log.info('ℹ️ PaulIA: No relevant information found');
        return `PaulIA n'a pas trouvé d'informations spécifiques pour "${input}". Recherche effectuée avec : "${searchQuery}" (confiance: ${(analysis.confidence * 100).toFixed(1)}%). Je peux quand même t'aider avec mes connaissances générales sur Paul !`;
      }

      const formattedResults = this.formatChromaResults(searchResults, input, searchQuery, analysis);

      this.strapi.log.info(`✅ PaulIA: Found ${searchResults.length} relevant documents using AI analysis`);

      return formattedResults;

    } catch (error) {
      this.strapi.log.error('❌ PaulIA SmartRAGTool error:', error);
      return `PaulIA a rencontré une erreur lors de l'analyse pour "${input}". Je peux essayer de répondre avec mes connaissances générales sur Paul.`;
    }
  }
}
