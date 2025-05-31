'use strict';
/**
 * Migration service for project data
 */
export default ({ strapi }) => ({
  async populateProjectsData() {
    try {
      console.log('Starting projects data population...');

      const projectsData = [
        {
          title: "Portfolio Website",
          image: "https://example.com/portfolio-image.jpg",
          link_npm: null,
          github_link: "https://github.com/PaulRichez/portfolio",
          description: "Mon site portfolio personnel développé avec Angular et Strapi. Il présente mes compétences, expériences et projets.",
          link_demo: "https://paulrichez.fr"
        },
        {
          title: "E-commerce Platform",
          image: "https://example.com/ecommerce-image.jpg",
          link_npm: null,
          github_link: "https://github.com/PaulRichez/ecommerce",
          description: "Plateforme e-commerce développée avec Angular, Node.js et PostgreSQL. Gestion complète des produits, commandes et paiements.",
          link_demo: "https://demo-ecommerce.example.com"
        },
        {
          title: "Task Management App",
          image: "https://example.com/task-app-image.jpg",
          link_npm: null,
          github_link: "https://github.com/PaulRichez/task-manager",
          description: "Application de gestion de tâches avec fonctionnalités de collaboration en temps réel. Développée avec React et Firebase.",
          link_demo: "https://task-manager-demo.example.com"
        },
        {
          title: "Angular Component Library",
          image: "https://example.com/library-image.jpg",
          link_npm: "https://www.npmjs.com/package/@paulrichez/angular-components",
          github_link: "https://github.com/PaulRichez/angular-components",
          description: "Bibliothèque de composants Angular réutilisables avec documentation complète et tests unitaires.",
          link_demo: "https://angular-components-demo.example.com"
        }
      ];

      for (const projectData of projectsData) {
        await this.createOrUpdateProject(projectData);
      }

      console.log('Projects data populated successfully');
      return true;
    } catch (error) {
      console.error('Failed to populate projects data:', error);
      throw error;
    }
  },

  async createOrUpdateProject(projectData) {
    try {
      // Check if project exists by title
      const existingProjects = await strapi.entityService.findMany('api::project.project', {
        filters: {
          title: projectData.title
        }
      });

      if (existingProjects && existingProjects.length > 0) {
        // Update existing project
        const updatedProject = await strapi.entityService.update('api::project.project', existingProjects[0].id, {
          data: projectData
        });
        console.log(`Project "${projectData.title}" updated successfully`);
        return updatedProject;
      } else {
        // Create new project
        const newProject = await strapi.entityService.create('api::project.project', {
          data: {
            ...projectData,
            publishedAt: new Date()
          }
        });
        console.log(`Project "${projectData.title}" created successfully`);
        return newProject;
      }
    } catch (error) {
      console.error(`Failed to create/update project "${projectData.title}":`, error);
      throw error;
    }
  },

  async deleteAllProjects() {
    try {
      const projects = await strapi.entityService.findMany('api::project.project');
      if (projects && projects.length > 0) {
        for (const project of projects) {
          await strapi.entityService.delete('api::project.project', project.id);
        }
        console.log('All projects deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete projects:', error);
      throw error;
    }
  }
});
