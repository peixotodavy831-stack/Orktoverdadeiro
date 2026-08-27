import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import apiApp from "./api/server";

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();

  // API routes MUST be before Vite middleware, otherwise Vite's SPA fallback
  // intercepts /api/* and returns index.html instead of JSON responses.
  app.use(apiApp);

  if (!process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  app.use('*', (_req, res) => {
    if (!process.env.VERCEL) {
      res.status(404).send('Dev server: use Vite para o frontend (localhost:5173)');
    } else {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    }
  });

  app.listen(PORT, () => {
    console.log(`[ORKTO] Servidor local rodando em http://localhost:${PORT}`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}

export { startServer };
