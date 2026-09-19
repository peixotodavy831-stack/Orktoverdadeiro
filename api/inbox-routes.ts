import { registerInboxRoutes } from './orkto-routes.js';
import { registerSwarmRoutes } from './swarm-routes.js';
import apiApp from './server.js';

// This shim exists so both route layers keep resolving through the same apiApp instance
// regardless of which entrypoint (server.ts or the standalone exec) boots the process.
registerInboxRoutes(apiApp);
registerSwarmRoutes(apiApp);

export { apiApp as app };
