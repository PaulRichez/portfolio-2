'use strict';

/**
 * me controller
 */

module.exports = {
  async find(ctx) {
    try {
      const entity = await strapi.entityService.findMany('api::me.me');
      return { data: entity };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async findWithPopulate(ctx) {
    try {
      const { projectsLimit } = ctx.query;
      
      const entity = await strapi.entityService.findMany('api::me.me', {
        populate: {
          languages: true,
          diplomas: true,
          experiences: true,
          coding_skills: {
            populate: {
              coding: true
            }
          }
        }
      });

      // Fetch projects separately with limit and sorting
      const limit = projectsLimit ? parseInt(projectsLimit) : 6;
      const projects = await strapi.entityService.findMany('api::project.project', {
        populate: {
          codings: true
        },
        sort: { createdAt: 'desc' },
        limit: limit
      });

      // Add projects to entity
      if (entity) {
        (entity as any).projects = projects;
      }

      return { data: entity };
    } catch (error) {
      ctx.throw(500, error);
    }
  }
};
