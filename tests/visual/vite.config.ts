import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { defineConfig } from 'vite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const visualOutput = path.join(tmpdir(), 'orkto-front-b-v2-visual-20260928');

export default defineConfig({
  root: projectRoot,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': projectRoot } },
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'lucide-react', '@supabase/supabase-js'],
  },
  build: {
    outDir: visualOutput,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(projectRoot, 'tests/visual/index.html'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    fs: { allow: [projectRoot] },
  },
});
