import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tools/example-matrix/tests/**/*.test.ts'],
    environment: 'node',
  },
});
