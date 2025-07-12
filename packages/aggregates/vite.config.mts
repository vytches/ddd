import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'capabilities/index': resolve(__dirname, 'src/capabilities/index.ts'),
      },
      name: 'VytchesDDDAggregates',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        '@vytches-ddd/domain-primitives',
        '@vytches-ddd/value-objects',
        '@vytches-ddd/utils',
        '@vytches-ddd/contracts',
        '@vytches-ddd/logging',
      ],
      output: {
        globals: {
          '@vytches-ddd/domain-primitives': 'VytchesDDDDomainPrimitives',
          '@vytches-ddd/value-objects': 'VytchesDDDValueObjects',
          '@vytches-ddd/utils': 'VytchesDDDUtils',
          '@vytches-ddd/contracts': 'VytchesDDDContracts',
          '@vytches-ddd/logging': 'VytchesDDDLogging',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  test: {
    globals: true,
    environment: 'node',
    root: __dirname,
    coverage: {
      enabled: false,
    },
  },
});
