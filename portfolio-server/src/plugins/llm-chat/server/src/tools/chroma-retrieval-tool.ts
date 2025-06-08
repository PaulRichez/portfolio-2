import { Tool } from "@langchain/core/tools";
import type { Core } from '@strapi/strapi';

// Interface pour les résultats de recherche
interface ChromaSearchResult {
  id: string;
  document: string;
  metadata: any;
  distance: number;
}

// Interface pour les options de recherche
interface ChromaSearchOptions {
  query: string;
  limit?: number;
  threshold?: number; // Seuil de similarité
  collection?: string; // Collection spécifique à filtrer
}

/**
 * Outil LangChain pour rechercher des informations dans ChromaDB
 * Cet outil permet au chat de récupérer automatiquement des données contextuelles
 * depuis la base vectorielle ChromaDB lorsque c'est nécessaire
 */
export class ChromaRetrievalTool extends Tool {
  name = "chroma_search";
  description = `Recherche des informations contextuelles dans la base de données vectorielle ChromaDB.
  Utilisez cet outil quand l'utilisateur pose des questions sur :
  - Les projets du portfolio
  - Les informations personnelles (compétences, expériences, formations)
  - Toute information spécifique qui pourrait être stockée dans la base de données

  Paramètre d'entrée : une requête de recherche en langage naturel (string)

  Exemples d'utilisation :
  - "projets web development"
  - "compétences React"
  - "formation développeur"
  - "expérience professionnelle"`;

  private strapi: Core.Strapi;
  private chromaService: any;

  constructor(strapi: Core.Strapi) {
    super();
    this.strapi = strapi;
    this.chromaService = strapi.plugin('llm-chat').service('chromaVectorService');
  }

  /**
   * Exécute la recherche dans ChromaDB
   */
  async _call(query: string): Promise<string> {
    try {
      this.strapi.log.info('🔍 ChromaRetrievalTool: Searching for:', query);

      // Rechercher dans ChromaDB avec votre service existant
      const searchResults: ChromaSearchResult[] = await this.chromaService.searchDocuments(query, 5);

      if (!searchResults || searchResults.length === 0) {
        return "Aucune information pertinente trouvée dans la base de données pour cette requête.";
      }

      // Formater les résultats pour le LLM
      const formattedResults = this.formatResultsForLLM(searchResults, query);

      this.strapi.log.info(`✅ ChromaRetrievalTool: Found ${searchResults.length} relevant documents`);

      return formattedResults;
    } catch (error) {
      this.strapi.log.error('❌ ChromaRetrievalTool error:', error);
      return "Erreur lors de la recherche dans la base de données. Informations non disponibles.";
    }
  }

  /**
   * Formate les résultats pour le LLM
   */
  private formatResultsForLLM(results: ChromaSearchResult[], originalQuery: string): string {
    const sections: string[] = [];

    sections.push(`=== Informations trouvées pour "${originalQuery}" ===\n`);

    results.forEach((result, index) => {
      const metadata = result.metadata || {};
      const collection = metadata.collection || 'unknown';
      const similarity = (1 - result.distance).toFixed(3); // Convertir distance en similarité

      sections.push(`${index + 1}. ${this.getCollectionDisplayName(collection)} (Pertinence: ${similarity})`);
      sections.push(`   ${result.document.trim()}`);

      // Ajouter des métadonnées pertinentes
      if (metadata.github_link) {
        sections.push(`   🔗 GitHub: ${metadata.github_link}`);
      }
      if (metadata.link_demo) {
        sections.push(`   🌐 Démo: ${metadata.link_demo}`);
      }
      if (metadata.email) {
        sections.push(`   📧 Email: ${metadata.email}`);
      }
      if (metadata.linkedin) {
        sections.push(`   💼 LinkedIn: ${metadata.linkedin}`);
      }

      sections.push(''); // Ligne vide entre les résultats
    });

    sections.push(`=== Fin des informations (${results.length} résultat${results.length > 1 ? 's' : ''}) ===`);

    return sections.join('\n');
  }

  /**
   * Convertit les noms de collection en noms d'affichage
   */
  private getCollectionDisplayName(collection: string): string {
    const displayNames: Record<string, string> = {
      'api::project.project': '📁 Projet',
      'api::me.me': '👤 Profil personnel',
      'api::article.article': '📝 Article',
      'api::faq.faq': '❓ FAQ'
    };

    return displayNames[collection] || `📄 ${collection}`;
  }
}

/**
 * Outil avancé avec filtres pour des recherches plus spécifiques
 */
export class ChromaAdvancedRetrievalTool extends Tool {
  name = "chroma_advanced_search";
  description = `Recherche avancée avec filtres dans ChromaDB.
  Utilisez cet outil pour des recherches plus spécifiques avec filtres.

  Paramètre d'entrée : objet JSON avec query, limit, et collection (optionnel)
  Exemple : {"query": "React projects", "limit": 3, "collection": "api::project.project"}`;

  private strapi: Core.Strapi;
  private chromaService: any;

  constructor(strapi: Core.Strapi) {
    super();
    this.strapi = strapi;
    this.chromaService = strapi.plugin('llm-chat').service('chromaVectorService');
  }

  async _call(input: string): Promise<string> {
    try {
      let searchOptions: ChromaSearchOptions;

      try {
        searchOptions = JSON.parse(input);
      } catch {
        // Si ce n'est pas du JSON, traiter comme une requête simple
        searchOptions = { query: input, limit: 5 };
      }

      this.strapi.log.info('🔍 ChromaAdvancedRetrievalTool: Advanced search:', searchOptions);

      const searchResults: ChromaSearchResult[] = await this.chromaService.searchDocuments(
        searchOptions.query,
        searchOptions.limit || 5
      );

      if (!searchResults || searchResults.length === 0) {
        return "Aucune information pertinente trouvée avec ces critères de recherche.";
      }

      // Filtrer par collection si spécifié
      let filteredResults = searchResults;
      if (searchOptions.collection) {
        filteredResults = searchResults.filter(result =>
          result.metadata?.collection === searchOptions.collection
        );
      }

      // Filtrer par seuil de similarité si spécifié
      if (searchOptions.threshold) {
        filteredResults = filteredResults.filter(result =>
          (1 - result.distance) >= searchOptions.threshold!
        );
      }

      if (filteredResults.length === 0) {
        return "Aucun résultat ne correspond aux critères de filtrage spécifiés.";
      }

      const formattedResults = this.formatAdvancedResults(filteredResults, searchOptions);

      this.strapi.log.info(`✅ ChromaAdvancedRetrievalTool: Found ${filteredResults.length} filtered results`);

      return formattedResults;
    } catch (error) {
      this.strapi.log.error('❌ ChromaAdvancedRetrievalTool error:', error);
      return "Erreur lors de la recherche avancée dans la base de données.";
    }
  }

  private formatAdvancedResults(results: ChromaSearchResult[], options: ChromaSearchOptions): string {
    const sections: string[] = [];

    sections.push(`=== Recherche avancée: "${options.query}" ===`);
    if (options.collection) {
      sections.push(`📂 Collection filtrée: ${this.getCollectionDisplayName(options.collection)}`);
    }
    if (options.threshold) {
      sections.push(`🎯 Seuil de similarité: ${options.threshold}`);
    }
    sections.push('');

    results.forEach((result, index) => {
      const metadata = result.metadata || {};
      const similarity = (1 - result.distance).toFixed(3);

      sections.push(`${index + 1}. ${this.getCollectionDisplayName(metadata.collection)} (Similarité: ${similarity})`);
      sections.push(`   ${result.document.trim()}`);

      // Métadonnées détaillées
      const relevantMetadata = this.extractRelevantMetadata(metadata);
      if (relevantMetadata.length > 0) {
        sections.push(`   Détails: ${relevantMetadata.join(', ')}`);
      }

      sections.push('');
    });

    return sections.join('\n');
  }

  private getCollectionDisplayName(collection: string): string {
    const displayNames: Record<string, string> = {
      'api::project.project': '📁 Projet',
      'api::me.me': '👤 Profil personnel',
      'api::article.article': '📝 Article',
      'api::faq.faq': '❓ FAQ'
    };

    return displayNames[collection] || `📄 ${collection}`;
  }

  private extractRelevantMetadata(metadata: any): string[] {
    const relevant: string[] = [];

    if (metadata.github_link) relevant.push(`GitHub: ${metadata.github_link}`);
    if (metadata.link_demo) relevant.push(`Démo: ${metadata.link_demo}`);
    if (metadata.email) relevant.push(`Email: ${metadata.email}`);
    if (metadata.phoneNumber) relevant.push(`Tél: ${metadata.phoneNumber}`);
    if (metadata.website) relevant.push(`Site: ${metadata.website}`);
    if (metadata.linkedin) relevant.push(`LinkedIn: ${metadata.linkedin}`);
    if (metadata.createdAt) relevant.push(`Créé: ${new Date(metadata.createdAt).toLocaleDateString()}`);

    return relevant;
  }
}
