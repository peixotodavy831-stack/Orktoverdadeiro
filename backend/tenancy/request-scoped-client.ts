import { AsyncLocalStorage } from 'node:async_hooks';

/** Bind a shared facade to one request's public or authenticated client. */
export function createRequestScopedClient<T extends object>(publicClient: T) {
  const storage = new AsyncLocalStorage<{ client: T }>();
  const client = new Proxy(publicClient, {
    get(_target, property) {
      const current = storage.getStore()?.client || publicClient;
      const value = Reflect.get(current, property);
      return typeof value === 'function' ? value.bind(current) : value;
    },
  });
  return {
    client,
    run<R>(callback: () => R): R {
      return storage.run({ client: publicClient }, callback);
    },
    useAuthenticatedClient(authenticatedClient: T): void {
      const context = storage.getStore();
      if (!context) throw new Error('Authenticated database client requires a request context.');
      context.client = authenticatedClient;
    },
  };
}
