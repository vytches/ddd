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
  resolve: {
    alias: {
      '@vytches-ddd/testing': resolve(__dirname, '../testing/src'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src'),
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src'),
      '@vytches-ddd/contracts': resolve(__dirname, '../contracts/src'),
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDDValueObjects',
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
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    alias: {
      '@vytches-ddd/testing': new URL('../testing/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/utils': new URL('../utils/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/domain-primitives': new URL(
        '../domain-primitives/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/contracts': new URL('../contracts/src/index.ts', import.meta.url).pathname,
    },
    // Disable coverage for individual package tests to prevent ENOENT errors
    coverage: {
      enabled: false,
    },
  },
});
