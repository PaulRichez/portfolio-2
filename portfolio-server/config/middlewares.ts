export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io'],
          'media-src': ["'self'", 'data:', 'blob:'],
          // autorise le front à afficher le CV PDF (servi par Strapi) en iframe
          'frame-ancestors': [
            "'self'",
            'http://localhost:4200',
            'http://localhost:4201',
            'https://paulrichez.fr',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
{
  name: 'strapi::cors',
  config: {
    enabled: true,
    origin: [
      'http://localhost:4200',
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
      'X-Forwarded-For',
      'Cache-Control'
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
