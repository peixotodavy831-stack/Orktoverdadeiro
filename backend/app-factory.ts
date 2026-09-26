import express, { type Express } from 'express';
import coreApp from './core-app.js';
import { registerInboxRoutes } from './orkto-routes.js';
import { registerSwarmRoutes } from './swarm-routes.js';

export const MOCK_ROUTES_FLAG = 'ORKTO_ENABLE_MOCK_ROUTES';

type RuntimeEnvironment = NodeJS.ProcessEnv;

export type CreateApiAppOptions = {
  env?: RuntimeEnvironment;
};

export function isProductionRuntime(env: RuntimeEnvironment): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || Boolean(env.VERCEL);
}

export function shouldEnableMockRoutes(env: RuntimeEnvironment): boolean {
  const requested = env[MOCK_ROUTES_FLAG] === 'true';

  if (requested && isProductionRuntime(env)) {
    throw new Error(`${MOCK_ROUTES_FLAG}=true is forbidden in production runtimes.`);
  }

  return requested;
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const env = options.env ?? process.env;
  const app = express();

  // The production API is always mounted. Mock/demo route layers are opt-in
  // and are rejected outright in production instead of relying on implicit
  // environment detection.
  app.use(coreApp);

  if (shouldEnableMockRoutes(env)) {
    registerInboxRoutes(app);
    registerSwarmRoutes(app);
  }

  return app;
}
