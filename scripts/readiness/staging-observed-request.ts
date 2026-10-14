import type { APIRequestContext } from '@playwright/test';
import { errorClass } from './staging-browser-security.mjs';
import { safeRoute } from './staging-diagnostics.mjs';

export function observeRequest(api: APIRequestContext): APIRequestContext {
  return new Proxy(api, {
    get(target, name) {
      const original = Reflect.get(target, name);
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch'].includes(String(name))) {
        return typeof original === 'function' ? original.bind(target) : original;
      }
      return async (url: string, options?: Parameters<APIRequestContext['fetch']>[1]) => {
        const started = performance.now();
        const event = { kind: 'request', ...safeRoute(url), method: String(options?.method || name).toUpperCase(), duration_ms: 0, status: 0, failure: 'NONE' };
        try {
          const response = await original.call(target, url, options);
          event.status = response.status();
          if (event.status >= 500) event.failure = 'HTTP_ERROR';
          return response;
        } catch (error) {
          const code = errorClass(error);
          event.failure = ['TIMEOUT', 'TLS_CERTIFICATE_ERROR'].includes(code) ? code : 'NETWORK_ERROR';
          throw error;
        } finally {
          event.duration_ms = Math.round(performance.now() - started);
          console.log('ORKTO_SAFE_EVENT ' + JSON.stringify(event));
        }
      };
    },
  });
}
