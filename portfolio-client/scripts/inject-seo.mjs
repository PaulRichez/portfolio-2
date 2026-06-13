/**
 * Injecte le contenu du portfolio (llms.txt généré par Strapi) dans un <noscript>
 * de l'index.html buildé → les crawlers / IA / fetch sans JS reçoivent le contenu
 * RÉEL (parcours, projets, compétences…) au lieu de la coquille vide de la SPA.
 *
 * Tolérant aux pannes : si l'API est injoignable au build, on saute sans erreur
 * (le Dockerfile l'appelle avec `|| true`). Le contenu se resynchronise à chaque build.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const INDEX = 'dist/portfolio-client/browser/index.html';
const LLMS_URL = process.env.LLMS_URL || 'https://api.paulrichez.fr/api/me/llms.txt';

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

try {
  if (!existsSync(INDEX)) throw new Error('index.html introuvable: ' + INDEX);

  const res = await fetch(LLMS_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const md = (await res.text()).trim();
  if (!md || md.length < 50) throw new Error('contenu vide/insuffisant');

  let html = readFileSync(INDEX, 'utf8');
  if (html.includes('id="seo-content"')) {
    console.log('[inject-seo] déjà injecté, skip');
    process.exit(0);
  }

  // IMPORTANT : un vrai <div> (PAS <noscript>). Les extracteurs HTML→texte des IA
  // suppriment <noscript>/<script>/<style> mais GARDENT le texte d'un <div>.
  const block =
    `<div id="seo-content" style="max-width:820px;margin:24px auto;padding:0 16px;font:14px/1.6 system-ui,-apple-system,sans-serif;color:#1e1e1e">` +
    `<pre style="white-space:pre-wrap;font-family:inherit">${esc(md)}</pre></div>`;
  // Injecté DANS <app-root> : Angular remplace ce contenu à son démarrage → les
  // visiteurs ne voient qu'un bref écran de chargement, mais les crawlers/IA (sans JS)
  // reçoivent tout le CV en clair.
  if (html.includes('<app-root></app-root>')) {
    html = html.replace('<app-root></app-root>', `<app-root>${block}</app-root>`);
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', block + '\n</body>');
  } else {
    html += block;
  }
  writeFileSync(INDEX, html);
  console.log(`[inject-seo] contenu injecté (${md.length} caractères)`);
} catch (e) {
  console.warn('[inject-seo] skip — ' + (e?.message || e));
}
