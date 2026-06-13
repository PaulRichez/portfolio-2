'use strict';

/**
 * GET /api/me/sitemap.xml (proxifié par nginx vers /sitemap.xml) → sitemap des
 * routes du portfolio, généré depuis le VFS (toujours en phase avec le contenu).
 */

const SITE = 'https://paulrichez.fr';

/** Même mapping fichier → URL que le front (models.ts : urlForFile), sans extension. */
function urlForFile(path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
  let base = path.slice(slash + 1);
  base = base.startsWith('.')
    ? base.slice(1).replace(/\.[^.]*$/, '')
    : base.replace(/\.[^.]+$/, '');
  return '/' + dir + base;
}

export default ({ strapi }) => ({
  async index(ctx) {
    try {
      const { files } = await strapi.service('api::me.vfs').getVfs();
      const routes = new Set<string>(['/']); // accueil (README)
      for (const f of files as any[]) {
        if (f.path === '.env' || f.path === 'README.md') continue; // gag + couvert par '/'
        routes.add(urlForFile(f.path));
      }
      const urls = [...routes]
        .map((u) => `  <url><loc>${SITE}${u}</loc></url>`)
        .join('\n');
      ctx.set('Content-Type', 'application/xml; charset=utf-8');
      ctx.set('Cache-Control', 'public, max-age=300');
      ctx.body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    } catch (error) {
      strapi.log.error('sitemap.xml: ' + (error as Error).message);
      ctx.throw(500, `Erreur sitemap: ${(error as Error).message}`);
    }
  },
});
