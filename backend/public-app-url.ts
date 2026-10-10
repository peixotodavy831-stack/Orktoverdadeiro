import { stagingPreviewOrigin } from './staging-boundary.js';

export class PublicAppUrlConfigurationError extends Error {
  readonly code = 'public_app_url_required';
  constructor() {
    super('APP_URL must be configured as a canonical public HTTPS origin.');
    this.name = 'PublicAppUrlConfigurationError';
  }
}

/** Resolves a public application origin without trusting request Host/Forwarded headers. */
export function resolvePublicAppBaseUrl(env: Record<string, string | undefined> = process.env): string {
  // An immutable, project-pinned Preview link must stay on the same deployment.
  // APP_URL can name a staging alias that has no deployment or points elsewhere.
  const previewOrigin = stagingPreviewOrigin(env);
  if (previewOrigin) return previewOrigin;
  const configured = env.APP_URL?.trim();
  if (!configured) {
    if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development' || env.APP_ENV === 'development') {
      return 'http://localhost:5173';
    }
    throw new PublicAppUrlConfigurationError();
  }

  try {
    const url = new URL(configured);
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!['https:', 'http:'].includes(url.protocol) || (url.protocol !== 'https:' && !localHttp))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('invalid public origin');
    }
    return url.origin;
  } catch {
    throw new PublicAppUrlConfigurationError();
  }
}
