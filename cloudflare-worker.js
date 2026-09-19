import { api } from './api/server.ts';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return api(request, env, ctx);
    }
    // Static asset fallback is handled by the platform; this worker only owns /api.
    return new Response('Not found', { status: 404 });
  },
};
