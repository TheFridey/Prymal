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
    manifest: true,
    modulePreload: {
      resolveDependencies(_, dependencies) {
        return dependencies.filter(
          (dependency) => !/vendor-three|vendor-workflow|app-workflow-builder/i.test(dependency),
        );
      },
    },
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
          if (id.includes('node_modules/reactflow')) {
            return 'vendor-workflow';
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
          if (
            id.includes('node_modules/react-markdown')
            || id.includes('node_modules/remark')
            || id.includes('node_modules/rehype')
          ) {
            return 'vendor-markdown';
          }
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry';
          }

          if (id.includes('WorkflowBuilder')) {
            return 'app-workflow-builder';
          }
          if (id.includes('/features/workspace/workflows/WebhookSubscriptionsPanel')) {
            return 'app-workflow-webhooks';
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
