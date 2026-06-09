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
      const limit = projectsLimit ? parseInt(projectsLimit) : 9;
      const projects = await strapi.entityService.findMany('api::project.project', {
        populate: {
          codings: true
        },
        sort: { createdAt: 'desc' },
        limit: limit
      });

      // Map Strapi field names (link_demo / github_link / link_npm) to the shape
      // the frontend project cards expect (demoUrl / sourceUrl / npmUrl) so the
      // "Démo" and "Code" buttons render correctly.
      const mappedProjects = (projects as any[]).map((p) => ({
        ...p,
        demoUrl: p.link_demo ?? null,
        sourceUrl: p.github_link ?? null,
        npmUrl: p.link_npm ?? null,
      }));

      // Add projects to entity
      if (entity) {
        (entity as any).projects = mappedProjects;
      }

      return { data: entity };
    } catch (error) {
      ctx.throw(500, error);
    }
  }
};
