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

      return { data: entity };
    } catch (error) {
      ctx.throw(500, error);
    }
  }
};
