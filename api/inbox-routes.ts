import { createApiApp } from './app-factory.js';

// Backward-compatible entrypoint. It now consumes the same application factory
// as local development and the Vercel function.
const app = createApiApp();

export { app, createApiApp };
export default app;
