import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createApiApp } from "./backend/app-factory";

dotenv.config();

const PORT = process.env.PORT || 3000;
const isProduction =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.VERCEL) ||
  process.argv[1]?.endsWith(".cjs");

async function startServer() {
  const app = express();
  const apiApp = createApiApp();

  // API routes MUST be before Vite middleware, otherwise Vite's SPA fallback
  // intercepts /api/* and returns index.html instead of JSON responses.
  app.use(apiApp);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota de API não encontrada.' });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  app.use('*', (_req, res) => {
    if (!isProduction) {
      res.status(404).send('Dev server: use Vite para o frontend (localhost:5173)');
    } else {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    }
  });

  app.listen(PORT, () => {
    console.log(`[ORKTO] Servidor local rodando em http://localhost:${PORT}`);
  });
}

if (process.argv[1] && /server\.(?:ts|js|cjs|mjs)$/.test(process.argv[1])) {
  startServer();
}

export { startServer };
