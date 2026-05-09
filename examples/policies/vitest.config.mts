import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@vytches/ddd-contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@vytches/ddd-domain-primitives': resolve(
        __dirname,
        '../../packages/domain-primitives/src/index.ts'
      ),
      '@vytches/ddd-policies': resolve(__dirname, '../../packages/policies/src/index.ts'),
      '@vytches/ddd-utils': resolve(__dirname, '../../packages/utils/src/index.ts'),
      '@vytches/ddd-validation': resolve(__dirname, '../../packages/validation/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
