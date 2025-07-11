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
      declarationMap: false,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDDDI',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        '@vytches-ddd/domain-primitives',
        '@vytches-ddd/logging',
        '@vytches-ddd/utils',
        '@nestjs/common',
        '@nestjs/core',
        'inversify',
        'tsyringe',
        'reflect-metadata',
      ],
    },
    sourcemap: true,
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src'),
      '@vytches-ddd/logging': resolve(__dirname, '../logging/src'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src'),
    },
  },
});
