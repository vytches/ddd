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
    }),
  ],
  resolve: {
    alias: {
      '@vytches-ddd/testing': resolve(__dirname, '../testing/src'),
      '@vytches-ddd/contracts': resolve(__dirname, '../contracts/src'),
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src'),
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDDRepositories',
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
    coverage: {
      enabled: false,
    },
    alias: {
      '@vytches-ddd/testing': resolve(__dirname, '../testing/src'),
      '@vytches-ddd/contracts': resolve(__dirname, '../contracts/src'),
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src'),
    },
  },
});
