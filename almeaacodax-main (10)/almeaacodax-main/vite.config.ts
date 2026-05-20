import path from 'path';
import { execSync } from 'child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    const appVersion =
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.CF_PAGES_COMMIT_SHA ||
      (() => {
        try {
          return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        } catch {
          return 'local';
        }
      })();

    return {
      define: {
        __APP_VERSION__: JSON.stringify(appVersion),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 900,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) {
                return undefined;
              }

              if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('\\react\\') || id.includes('/react/')) {
                return 'react-core';
              }

              if (id.includes('katex')) {
                return 'math-rendering';
              }

              if (id.includes('react-quill-new')) {
                return 'editor';
              }

              if (id.includes('recharts')) {
                return 'charts';
              }

              if (id.includes('lucide-react')) {
                return 'icons';
              }

              if (id.includes('motion')) {
                return 'motion';
              }

              if (id.includes('@google/genai')) {
                return 'ai-sdk';
              }

              if (id.includes('xlsx')) {
                return 'spreadsheet';
              }

              return undefined;
            },
          },
        },
      }
    };
});
