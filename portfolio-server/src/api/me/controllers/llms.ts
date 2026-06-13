'use strict';

/**
 * GET /api/me/llms.txt (proxifié par nginx vers /llms.txt) → document Markdown
 * lisible par les IA / LLM (convention https://llmstxt.org). Réutilise le contenu
 * du VFS (mêmes données réelles que le site) → un seul endroit à maintenir.
 *
 * Objectif : un crawler LLM ou un simple fetch (qui n'exécutent PAS le JS de la
 * SPA) reçoit ici le portfolio complet en texte propre, au lieu de la coquille
 * vide `<app-root>`.
 */

const ageOf = (b: string): number | null => {
  if (!b) return null;
  const d = new Date(b);
  if (isNaN(d.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
};

export default ({ strapi }) => ({
  async index(ctx) {
    try {
      const me: any = (await strapi.service('api::me.cv').getCvData()) || {};
      const { files } = await strapi.service('api::me.vfs').getVfs();

      // Pas de tri alphabétique : on garde l'ordre du VFS (expériences anté-chrono,
      // projets par ranking) — sinon CIM remonterait avant Rewayz.
      const pick = (prefix: string): string[] =>
        files
          .filter((f: any) => f.path.startsWith(prefix))
          .map((f: any) => String(f.content || '').trim());
      const file = (path: string): string =>
        String(files.find((f: any) => f.path === path)?.content || '').trim();

      const name = `${me.firstName || ''} ${me.lastName || ''}`.trim() || 'Paul Richez';
      const age = ageOf(me.birthDay);
      const sub = [me.city ? `${me.city}, France` : '', age ? `${age} ans` : ''].filter(Boolean).join(' · ');
      const links = [
        me.email ? `Email : ${me.email}` : '',
        me.github ? `GitHub : ${me.github}` : '',
        me.website ? `Site : ${me.website}` : '',
      ].filter(Boolean).join(' · ');

      const out: string[] = [];
      out.push(`# ${name} — ${me.postName || 'Développeur Fullstack'}`);
      if (sub) out.push(sub);
      if (links) out.push(links);
      out.push('');
      out.push('> Version lisible par IA (llms.txt) du portfolio https://paulrichez.fr — développeur fullstack Angular + Strapi, freelance, basé à Lille.');

      const exp = pick('experience/');
      if (exp.length) out.push('\n---\n\n# Parcours\n\n' + exp.join('\n\n'));

      const edu = pick('education/');
      if (edu.length) out.push('\n---\n\n# Formation\n\n' + edu.join('\n\n'));

      const proj = pick('projects/');
      if (proj.length) out.push('\n---\n\n# Projets\n\n' + proj.join('\n\n'));

      const skills = file('skills.json');
      if (skills) out.push('\n---\n\n# Compétences\n\n```json\n' + skills + '\n```');

      const contact = file('contact.md');
      if (contact) out.push('\n---\n\n' + contact);

      ctx.set('Content-Type', 'text/plain; charset=utf-8');
      ctx.set('Cache-Control', 'public, max-age=300');
      ctx.body = out.join('\n');
    } catch (error) {
      strapi.log.error('llms.txt: ' + (error as Error).message);
      ctx.throw(500, `Erreur llms.txt: ${(error as Error).message}`);
    }
  },
});
