export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
{
  name: 'strapi::cors',
  config: {
    enabled: true,
    origin: [
      'http://localhost:4201',
      'http://192.168.1.32:3000',
      'http://localhost:3000',
      'https://paulrichez.fr'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: [
      'Content-Type',
      'Authorization',
      'Origin',
      'Accept',
      'X-Requested-With',
    ],
    credentials: true,
  },
},
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
