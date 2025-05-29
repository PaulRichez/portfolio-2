'use strict';

async function up(trx) {
  // Use setTimeout to delay the service call after Strapi is fully loaded
  setTimeout(async () => {
    await strapi.service('api::me.migration').populateMeData();
  }, 60000); // 60 seconds delay
}

module.exports = { up };
