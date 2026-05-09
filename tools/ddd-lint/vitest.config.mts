import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tools/ddd-lint/tests/**/*.test.ts'],
    environment: 'node',
  },
});
