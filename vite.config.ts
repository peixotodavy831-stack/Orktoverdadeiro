import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig, loadEnv} from 'vite';
import { assertStagingBoundary } from './backend/staging-boundary';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isolatedBuild = process.env.ORKTO_READINESS_ISOLATED_BUILD === '1';
  assertStagingBoundary(isolatedBuild ? process.env : { ...loadEnv(mode, projectRoot, ''), ...process.env });
  return {
    envDir: isolatedBuild ? process.env.ORKTO_READINESS_ENV_DIR : projectRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'vendor-animation';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'vendor-charts';
            if (id.includes('node_modules/three/') || id.includes('node_modules/@react-three/fiber/')) return 'vendor-webgl';
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
