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

  const block =
    `<noscript id="seo-content"><pre style="white-space:pre-wrap;font-family:inherit">${esc(md)}</pre></noscript>`;
  html = html.includes('</body>')
    ? html.replace('</body>', block + '\n</body>')
    : html + block;
  writeFileSync(INDEX, html);
  console.log(`[inject-seo] contenu injecté (${md.length} caractères)`);
} catch (e) {
  console.warn('[inject-seo] skip — ' + (e?.message || e));
}
