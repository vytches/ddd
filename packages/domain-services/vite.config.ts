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
    sourcemap: true,
    target: 'ES2020',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    alias: {
      '@vytches-ddd/core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/utils': new URL('../utils/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/contracts': new URL('../contracts/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/events': new URL('../events/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/validation': new URL('../validation/src/index.ts', import.meta.url).pathname,
    },
  },
});