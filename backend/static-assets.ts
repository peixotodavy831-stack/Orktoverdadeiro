import express, { type Express } from 'express';
import path from 'node:path';

/** The server bundle shares dist with public assets, but is never public. */
export function mountProductionAssets(app: Express, directory: string) {
  app.use((req, res, next) => {
    let pathname: string;
    try { pathname = decodeURIComponent(req.path); }
    catch { res.sendStatus(400); return; }
    if (/\.(?:cjs|mjs|ts|tsx|map)(?:\/|$)/i.test(pathname) || pathname.split(/[\\/]/).some(part => part.startsWith('.'))) {
      res.sendStatus(404);
      return;
    }
    next();
  });
  app.use(express.static(directory, { dotfiles: 'deny' }));
  app.get('*', (_req, res) => res.sendFile(path.join(directory, 'index.html')));
}
