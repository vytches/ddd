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
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    // Disable coverage for individual package tests to prevent ENOENT errors
    coverage: {
      enabled: false,
    },
    deps: {
      // Avoid problematic root package.json directory resolution
      external: [/^\/package\.json/],
    },
    alias: {
      '@vytches-ddd/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/domain-primitives': new URL(
        '../../packages/domain-primitives/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/value-objects': new URL(
        '../../packages/value-objects/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/repositories': new URL(
        '../../packages/repositories/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/aggregates': new URL('../../packages/aggregates/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/utils': new URL('../../packages/utils/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/validation': new URL('../../packages/validation/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/policies': new URL('../../packages/policies/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/events': new URL('../../packages/events/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/cqrs': new URL('../../packages/cqrs/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/acl': new URL('../../packages/acl/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/projections': new URL(
        '../../packages/projections/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/messaging': new URL('../../packages/messaging/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/resilience': new URL('../../packages/resilience/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/testing': new URL('../../packages/testing/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/enterprise': new URL('../../packages/enterprise/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/cli': new URL('../../packages/cli/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/contracts': new URL('../../packages/contracts/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/domain-services': new URL(
        '../../packages/domain-services/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/logging': new URL('../../packages/logging/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/di': new URL('../../packages/di/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/event-store': new URL(
        '../../packages/event-store/src/index.ts',
        import.meta.url
      ).pathname,
    },
  },
});
