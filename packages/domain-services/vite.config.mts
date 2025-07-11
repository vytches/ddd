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
      '@vytches-ddd/core': resolve(__dirname, '../core/src/index.ts'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src/index.ts'),
      '@vytches-ddd/contracts': resolve(__dirname, '../contracts/src/index.ts'),
      '@vytches-ddd/events': resolve(__dirname, '../events/src/index.ts'),
      '@vytches-ddd/validation': resolve(__dirname, '../validation/src/index.ts'),
      '@vytches-ddd/aggregates': resolve(__dirname, '../aggregates/src/index.ts'),
      '@vytches-ddd/logging': resolve(__dirname, '../logging/src/index.ts'),
      '@vytches-ddd/value-objects': resolve(__dirname, '../value-objects/src/index.ts'),
      '@vytches-ddd/di': resolve(__dirname, '../di/src/index.ts'),
      '@vytches-ddd/testing': resolve(__dirname, '../testing/src/index.ts'),
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src/index.ts'),
    },
  },
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
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    alias: {
      '@vytches-ddd/core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/utils': new URL('../utils/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/contracts': new URL('../contracts/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/events': new URL('../events/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/validation': new URL('../validation/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/aggregates': new URL('../aggregates/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/logging': new URL('../logging/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/value-objects': new URL('../value-objects/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/di': new URL('../di/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/testing': new URL('../testing/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/domain-primitives': new URL(
        '../domain-primitives/src/index.ts',
        import.meta.url
      ).pathname,
    },
    coverage: {
      enabled: false,
    },
  },
});
