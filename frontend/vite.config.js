import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // CSS code splitting — each async chunk gets its own CSS file,
    // so admin/workflow surfaces only load their styles on demand.
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor: stable libraries with long cache TTL ────────────────
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/@remix-run')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/@clerk/')) {
            return 'vendor-clerk';
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/gsap')) {
            return 'vendor-gsap';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three/')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/rehype')) {
            return 'vendor-markdown';
          }
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry';
          }

          // ── App: route-level lazy chunks ────────────────────────────────
          // Heavy admin surfaces — loaded only when operator navigates to /admin
          if (id.includes('/features/admin/') || id.includes('/pages/Admin')) {
            return 'app-admin';
          }
          // Workflow builder — heavy canvas surface, lazy loaded
          if (id.includes('WorkflowBuilder') || id.includes('/features/workspace/workflows/')) {
            return 'app-workflow-builder';
          }
          // Lore / knowledge surfaces
          if (id.includes('/features/workspace/lore/') || id.includes('/pages/Lore')) {
            return 'app-lore';
          }
          // Marketing / landing pages — separate from app shell
          if (id.includes('/features/marketing/') || id.includes('/pages/Landing') || id.includes('/pages/Pricing')) {
            return 'app-marketing';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['tests/**'],
  },
});
