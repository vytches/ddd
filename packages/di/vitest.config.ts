import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/examples/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@vytches-ddd/domain-primitives': resolve(__dirname, '../domain-primitives/src'),
      '@vytches-ddd/logging': resolve(__dirname, '../logging/src'),
      '@vytches-ddd/utils': resolve(__dirname, '../utils/src')
    }
  }
});