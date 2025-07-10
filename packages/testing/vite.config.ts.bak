/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
      declarationMap: false, // Disable .d.ts.map files for smaller bundles
    }),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDD',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: id => {
        return id.startsWith('@vytches-ddd/') && !id.includes('src/');
      },
    },
    sourcemap: false, // Disable source maps for production builds
    target: 'ES2020',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    alias: {
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src'),
      '@vytches-ddd/core': resolve(__dirname, '../core/src'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src'),
      '@vytches-ddd/events': resolve(__dirname, '../events/src'),
      '@vytches-ddd/contracts': resolve(__dirname, '../contracts/src'),
      '@vytches-ddd/logging': resolve(__dirname, '../logging/src'),
      '@vytches-ddd/aggregates': resolve(__dirname, '../aggregates/src'),
    },
  },
});
