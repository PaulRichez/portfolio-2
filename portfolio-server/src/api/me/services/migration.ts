'use strict';
/**
 * Migration service for me data
 */
export default ({ strapi }) => ({
  async populateAllData() {
    try {
      console.log('Starting complete data population...');

      // Populate coding data
      await strapi.service('api::coding.migration').populateCodingsData();

      // Populate projects data
      await strapi.service('api::project.migration').populateProjectsData();

      // Populate me data
      await this.populateMeData();


      console.log('All data populated successfully');
      return true;
    } catch (error) {
      console.error('Failed to populate all data:', error);
      throw error;
    }
  },

  async populateMeData() {
    try {
      console.log('Starting me data population...');

      // Check if data already exists
      const existingMe = await strapi.entityService.findMany('api::me.me');
      if (existingMe) {
        await strapi.service('api::me.migration').deleteMeData();
        console.log('Me data already exists, deleting existing data...');
      }

      // Helper function to get coding skills with IDs
      const getCodingSkills = async () => {
        const coding_skills = [
          { name: "HTML", level: "advanced" },
          { name: "CSS", level: "advanced" },
          { name: "JavaScript", level: "advanced" },
          { name: "Angular", level: "expert" },
          { name: "React", level: "beginner" },
          { name: "Vue.js", level: "beginner" },
          { name: "Strapi", level: "advanced" },
          { name: "Node.js", level: "Intermediate" },
          { name: "PostgreSQL", level: "Intermediate" },
          { name: "Docker", level: "Intermediate" },
          { name: "Java", level: "beginner" },
          { name: "Webmethods", level: "beginner" },
          { name: "Powerbuilder", level: "beginner" }
        ];

        const codingSkillsWithIds = [];
        
        for (const skill of coding_skills) {
          const coding = await strapi.entityService.findMany('api::coding.coding', {
            filters: { name: skill.name }
          });
          
          if (coding && coding.length > 0) {
            codingSkillsWithIds.push({
              coding: coding[0].id,
              level: skill.level
            });
          } else {
            console.warn(`Coding "${skill.name}" not found in database`);
          }
        }
        
        return codingSkillsWithIds;
      };

      // Get coding skills with proper IDs
      const codingSkills = await getCodingSkills();

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
              "Utilisation de Firebase",
              "Utilisation de nodeJs"
            ]
          },
          {
            startDate: "2014-07-01",
            endDate: "2016-10-01",
            title: "Concepteur - Développeur",
            business: "CIM",
            businessWebsite: "https://www.sa-cim.fr",
            descriptions: ["Correction et évolution d'un progiciel de gestion en Powerbuilder."]
          }
        ],

        // Coding skills with proper IDs
        coding_skills: codingSkills
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