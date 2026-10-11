'use strict';

/**
 * Contrôleur de chat.
 * - POST /chat/agent : la boucle d'agent d'aparté (services/chat.ts), servie en NDJSON.
 *   Pont Koa → Fetch : on construit une `Request`, on recopie la `Response` dans la socket.
 * - POST /chat/suggestions : questions de relance, demandées par le front après un tour.
 */
const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:3000',
  'https://paulrichez.fr',
];

// Rate-limit par IP en mémoire (anti-spam des endpoints LLM publics).
const RATE_MAX = 20;          // requêtes
const RATE_WINDOW = 60_000;   // par minute
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

const TOO_FAST = 'Tu vas un peu vite 😅 — laisse-moi reprendre mon souffle et réessaie dans une minute.';

export default ({ strapi }) => ({

  async agent(ctx) {
    if (rateLimited(ctx.request.ip || 'unknown')) {
      ctx.status = 429;
      ctx.body = { error: TOO_FAST };
      return;
    }

    // Stop dans le navigateur ferme la connexion : la boucle (modèle et outils) s'arrête avec.
    const closed = new AbortController();
    ctx.res.on('close', () => closed.abort());

    const origin = ctx.request.header.origin;
    const cors = ALLOWED_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

    let response: Response;
    try {
      const handler = await strapi.service('api::me.chat').handler();
      response = await handler(new Request(`http://localhost${ctx.url}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ctx.request.body ?? {}),
        signal: closed.signal,
      }));
    } catch (error) {
      strapi.log.error('Chat agent : ' + (error as Error).message);
      ctx.status = 500;
      ctx.body = { error: 'Le chat est indisponible.' };
      return;
    }

    // ctx.respond = false → on écrit nous-mêmes dans la socket (bypass Koa),
    // donc on pose aussi les en-têtes CORS à la main.
    ctx.respond = false;
    const res = ctx.res;
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers),
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      ...cors,
    });
    try {
      if (response.body) for await (const chunk of response.body as any) res.write(chunk);
    } catch (error) {
      if (!closed.signal.aborted) strapi.log.error('Chat agent (flux) : ' + (error as Error).message);
    } finally {
      res.end();
    }
  },

  async suggestions(ctx) {
    if (rateLimited(ctx.request.ip || 'unknown')) {
      ctx.body = { suggestions: [] };
      return;
    }
    const { question, answer } = (ctx.request.body || {}) as any;
    ctx.body = {
      suggestions: await strapi.service('api::me.chat').suggestions(String(question ?? ''), String(answer ?? '')),
    };
  },
});
