'use strict';
/**
 * Migration service for me data
 */
export default ({ strapi }) => ({
  async populateMeData() {
    try {
      console.log('Starting me data population...');

      // Check if data already exists
      const existingMe = await strapi.entityService.findMany('api::me.me');
      if (existingMe) {
        await strapi.service('api::me.migration').deleteMeData();
        console.log('Me data already exists, deleting existing data...');
      }

      // Create the main "me" entry with all components
      const meData = {
        lastName: "Richez",
        firstName: "Paul",
        city: "Lille",
        birthDay: "1992-09-08",
        phoneNumber: "07 77 30 19 65",
        email: "paul.richez59@gmail.com",
        postName: "Développeur web",
        linkedin: "https://www.linkedin.com/in/paul-richez/",
        github: "https://github.com/PaulRichez",
        website: "https://paulrichez.fr",

        // Languages components
        languages: [
          { name: "Français", value: 100 },
          { name: "Anglais", value: 40 }
        ],

        // Diplomas components
        diplomas: [
          {
            startDate: "2012-01-01",
            endDate: "2013-01-01",
            title: "Licence Professionnelle Informatique de Gestion",
            description: "Université de Valenciennes"
          },
          {
            startDate: "2010-01-01",
            endDate: "2012-01-01",
            title: "BTS Informatique de Gestion Option Développeur d'Applications",
            description: "Lycée Henri Wallon, Valenciennes"
          },
          {
            startDate: "2009-01-01",
            endDate: "2010-01-01",
            title: "Baccalauréat STI Option Génie Electrotechnique",
            description: "Lycée Paul Duez, Cambrai"
          }
        ],

        // Experiences components
        experiences: [
          {
            startDate: "2023-04-11",
            endDate: null,
            title: "Développeur Fullstack",
            business: "Rewayz",
            businessWebsite: "https://rewayz.com",
            descriptions: ["Développement d'une plateforme web avec Angular et Strapi"]
          },
          {
            startDate: "2020-07-07",
            endDate: "2021-05-01",
            title: "Développeur",
            business: "E-Mothep Consultants",
            businessWebsite: "https://e-mothep.fr",
            descriptions: ["Développement d'interfaces web avec Angular2+"]
          },
          {
            startDate: "2019-10-01",
            endDate: "2020-07-01",
            title: "Ingénieur d'études web et multimédia",
            business: "JetDev",
            businessWebsite: "https://www.jetdev.fr",
            descriptions: [
              "Développement d'une interface web avec Angular2+",
              "Utilisation de Java (Spring boot) et de AgGrid",
              "Méthodologie agile"
            ]
          },
          {
            startDate: "2017-11-01",
            endDate: "2019-09-01",
            title: "Développeur",
            business: "Elosi",
            businessWebsite: "https://www.elosi.com",
            descriptions: [
              "Développement d'un site web en AngularJS en front avec quelques notions de back-end en JAVA et Elasticsearch",
              "Intégration de flux avec Webmethods.",
              "Création d'API rest avec Webmethods.",
              "Développement de cockpit avec Angular2+",
              "Utiisation de Firebase",
              "Utiisation de nodeJs"
            ]
          },
          {
            startDate: "2014-07-01",
            endDate: "2016-10-01",
            title: "Concepteur - Développeur",
            business: "CIM",
            businessWebsite: "https://www.sa-cim.fr",
            descriptions: ["Correction et évolution d'un prologiciel de gestion en Powerbuilder."]
          }
        ],

        // "beginner",
        // "Intermediate",
        // "advanced",
        // "expert"
        codings: [
          {
            name: "HTML",
            level: "advanced",
            category: "frontend_languages",
            icon: "https://cdn.simpleicons.org/html5"
          },
          {
            name: "CSS",
            level: "advanced",
            category: "frontend_languages",
            icon: "https://cdn.simpleicons.org/css3"
          },
          {
            name: "JavaScript",
            level: "advanced",
            category: "frontend_languages",
            icon: "https://cdn.simpleicons.org/javascript"
          },
          {
            name: "Angular",
            level: "expert",
            category: "frontend_frameworks",
            icon: "https://cdn.simpleicons.org/angular"
          },
          {
            name: "React",
            level: "beginner",
            category: "frontend_frameworks",
            icon: "https://cdn.simpleicons.org/react"
          },
          {
            name: "Vue.js",
            level: "beginner",
            category: "frontend_frameworks",
            icon: "https://cdn.simpleicons.org/vuedotjs"
          },
          {
            name: "Strapi",
            level: "advanced",
            category: "backend",
            icon: "https://cdn.simpleicons.org/strapi"
          },
          {
            name: "Node.js",
            level: "Intermediate",
            category: "backend",
            icon: "https://cdn.simpleicons.org/nodedotjs"
          },
          {
            name: "PostgreSQL",
            level: "Intermediate",
            category: "databases",
            icon: "https://cdn.simpleicons.org/postgresql"
          },
          {
            name: "Docker",
            level: "Intermediate",
            category: "devops_tools",
            icon: "https://cdn.simpleicons.org/docker"
          },
          {
            name: "Java",
            level: "beginner",
            category: "backend",
            icon: "https://cdn.simpleicons.org/openjdk"
          },
          {
            name: "Webmethods",
            level: "beginner",
            category: 'other_languages',
            icon: "data:image/png;base64,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"
          },
          {
            name: "Powerbuilder",
            level: "beginner",
            category: 'other_languages',
            icon: "data:image/png;base64,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"
          }
        ]
      };

      // Create the me entry with all components
      const result = await strapi.entityService.create('api::me.me', {
        data: meData
      });

      console.log('Me data populated successfully:', result.id);
      return result;
    } catch (error) {
      console.error('Failed to populate me data:', error);
      throw error;
    }
  },

  async deleteMeData() {
    try {
      const me = await strapi.entityService.findMany('api::me.me');
      if (me) {
        await strapi.entityService.delete('api::me.me', me.id);
        console.log('Me data deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete me data:', error);
      throw error;
    }
  }
});