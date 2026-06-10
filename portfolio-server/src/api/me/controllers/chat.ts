'use strict';

/**
 * Contrôleur de chat — SSE (Server-Sent Events) en streaming.
 * Contrat conservé côté front : data: { type: start|chunk|complete|error, ... }.
 */
const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:3000',
  'https://paulrichez.fr',
];

// Rate-limit par IP en mémoire (anti-spam de l'endpoint LLM public).
const RATE_MAX = 20;          // messages
const RATE_WINDOW = 60_000;   // par minute
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

export default ({ strapi }) => ({

  async stream(ctx) {
    const { message, sessionId } = (ctx.request.body || {}) as any;
    const sid = sessionId || `session-${Date.now()}`;
    const origin = ctx.request.header.origin;
    const ip = ctx.request.ip || 'unknown';

    // ctx.respond = false → on écrit nous-mêmes dans la socket (bypass Koa),
    // donc on pose aussi les en-têtes CORS à la main.
    ctx.respond = false;
    const res = ctx.res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(ALLOWED_ORIGINS.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' }
        : {}),
    });

    const write = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      write({ type: 'start', sessionId: sid });
      if (rateLimited(ip)) {
        write({ type: 'chunk', content: 'Tu vas un peu vite 😅 — laisse-moi reprendre mon souffle et réessaie dans une minute.' });
        write({ type: 'complete', sessionId: sid, response: '' });
        return;
      }
      let full = '';
      for await (const evt of strapi.service('api::me.chat').streamChat(sid, message)) {
        if (evt?.type === 'chunk') full += evt.content;
        write(evt);
      }
      write({ type: 'complete', sessionId: sid, response: full });
    } catch (error) {
      strapi.log.error('Chat stream: ' + (error as Error).message);
      write({ type: 'error', message: (error as Error).message });
    } finally {
      res.end();
    }
  },

  /** Historique de la session (en mémoire) — pour la restauration côté front. */
  async history(ctx) {
    const sessionId = ctx.query.sessionId as string;
    const messages = sessionId ? strapi.service('api::me.chat').getSession(sessionId) : [];
    ctx.body = { messages, messageCount: messages.length, session: null };
  },

  /** Efface la session courante. */
  async clear(ctx) {
    const sessionId = ctx.query.sessionId as string;
    if (sessionId) strapi.service('api::me.chat').clearSession(sessionId);
    ctx.body = { success: true, sessionId: sessionId || null };
  },
});
