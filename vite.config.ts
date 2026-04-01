import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Allows imports like '@/features/auth/useAuth'
      // instead of '../../features/auth/useAuth'
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Vitest config lives here — no separate vitest.config.ts needed
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
