'use strict';
/**
 * Migration service for coding data
 */
export default ({ strapi }) => ({
  async populateCodingsData() {
    try {
      console.log('Starting coding data population...');

      const codings = [
        {
          name: "HTML",
          category: "frontend_languages",
          icon: "https://cdn.simpleicons.org/html5",
          ranking: 5
        },
        {
          name: "CSS",
          category: "frontend_languages",
          icon: "https://cdn.simpleicons.org/css3",
          ranking: 6
        },
        {
          name: "JavaScript",
          category: "frontend_languages",
          icon: "https://cdn.simpleicons.org/javascript",
          ranking: 3
        },
        {
          name: "Angular",
          category: "frontend_frameworks",
          icon: "https://cdn.simpleicons.org/angular",
          ranking: 1
        },
        {
          name: "React",
          category: "frontend_frameworks",
          icon: "https://cdn.simpleicons.org/react",
          ranking: 4
        },
        {
          name: "Vue.js",
          category: "frontend_frameworks",
          icon: "https://cdn.simpleicons.org/vuedotjs",
          ranking: 4
        },
        {
          name: "Strapi",
          category: "backend",
          icon: "https://cdn.simpleicons.org/strapi",
          ranking: 2
        },
        {
          name: "Node.js",
          category: "backend",
          icon: "https://cdn.simpleicons.org/nodedotjs",
          ranking: 2
        },
        {
          name: "PostgreSQL",
          category: "databases",
          icon: "https://cdn.simpleicons.org/postgresql",
          ranking: 4
        },
        {
          name: "Docker",
          category: "tools",
          icon: "https://cdn.simpleicons.org/docker",
          ranking: 5
        },
        {
          name: "Ollama",
          category: "ai",
          icon: "https://cdn.simpleicons.org/ollama",
          ranking: 2
        },
        {
          name: "LangChain",
          category: "ai",
          icon: "https://cdn.simpleicons.org/langchain",
          ranking: 2
        },
        {
          name: "Zhipu AI",
          category: "ai",
          icon: "https://cdn.simpleicons.org/openai",
          ranking: 3
        },
        {
          name: "ChromaDB",
          category: "ai",
          icon: "https://cdn.simpleicons.org/chroma",
          ranking: 3
        },
        {
          name: "Java",
          category: "backend",
          icon: "https://cdn.simpleicons.org/openjdk",
          ranking: 5
        },
        {
          name: "Webmethods",
          category: 'other_languages',
          icon: "data:image/png;base64,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",
          ranking: 6
        },
        {
          name: "Powerbuilder",
          category: 'other_languages',
          icon: "data:image/png;base64,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",
          ranking: 6
        },
        {
          name: "PrimeNG",
          category: "frontend_libraries",
          icon: "https://www.primefaces.org/primeng/assets/showcase/images/primeng-logo.svg",
          ranking: 2
        },
        {
          name: "Nebular",
          category: "frontend_libraries",
          icon: "https://akveo.github.io/nebular/assets/images/nebular-logo-300.png",
          ranking: 3
        },
        {
          name: "ECharts",
          category: "frontend_libraries",
          icon: "https://cdn.simpleicons.org/apacheecharts",
          ranking: 2
        }
      ];

      for (const coding of codings) {
        await this.createOrUpdateCoding(coding);
      }

      console.log('codings data populated successfully');
      return true;
    } catch (error) {
      console.error('Failed to populate codings data:', error);
      throw error;
    }
  },

  async createOrUpdateCoding(codingData) {
    try {
      // Check if coding exists by name
      const existingCodings = await strapi.entityService.findMany('api::coding.coding', {
        filters: {
          name: codingData.name
        }
      });

      if (existingCodings && existingCodings.length > 0) {
        // Update existing coding
        const updatedCoding = await strapi.entityService.update('api::coding.coding', existingCodings[0].id, {
          data: codingData
        });
        console.log(`Coding "${codingData.name}" updated successfully`);
        return updatedCoding;
      } else {
        // Create new coding
        const newData = await strapi.entityService.create('api::coding.coding', {
          data: {
            ...codingData,
            publishedAt: new Date()
          }
        });
        console.log(`Coding "${codingData.name}" created successfully`);
        return newData;
      }
    } catch (error) {
      console.error(`Failed to create/update coding "${codingData.name}":`, error);
      throw error;
    }
  },

  async deleteAllCodings() {
    try {
      const codings = await strapi.entityService.findMany('api::coding.coding');
      if (codings && codings.length > 0) {
        for (const coding of codings) {
          await strapi.entityService.delete('api::coding.coding', coding.id);
        }
        console.log('All codigns deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete codigns:', error);
      throw error;
    }
  }
});
