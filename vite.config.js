import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

const tempDir = path.join(os.tmpdir(), 'vite-cache-norahub-' + process.pid);

export default defineConfig({
  plugins: [react()],
  cacheDir: tempDir,

  build: {
    // Remove todos os console.* em produção
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': [
            'firebase/app', 'firebase/auth',
            'firebase/firestore', 'firebase/storage', 'firebase/functions',
          ],
          'vendor-ui':       ['lucide-react'],
          'vendor-charts':   ['recharts'],
        },
      },
    },
  },

  server: {
    headers: {
      'Service-Worker-Allowed':         '/',
      'X-Content-Type-Options':         'nosniff',
      'X-Frame-Options':                'DENY',
      'X-XSS-Protection':               '1; mode=block',
      'Referrer-Policy':                'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy':     'unsafe-none',
      'Cross-Origin-Embedder-Policy':   'unsafe-none',
    },
  },
});
