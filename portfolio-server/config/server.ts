export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1338),
  // URL publique (prod) — sert aux liens absolus générés côté serveur (ex. lien CV
  // dans le README du VFS) et aux URLs médias. En dev (vide) → fallback localhost.
  url: env('PUBLIC_URL', ''),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
