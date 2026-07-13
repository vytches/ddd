import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tools/docs-compile-gate/tests/**/*.test.ts'],
    environment: 'node',
  },
});
