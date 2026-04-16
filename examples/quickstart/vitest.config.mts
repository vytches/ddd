import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@vytches/ddd-events': resolve(__dirname, '../../packages/events/src/index.ts'),
      '@vytches/ddd-aggregates': resolve(__dirname, '../../packages/aggregates/src/index.ts'),
      '@vytches/ddd-contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@vytches/ddd-validation': resolve(__dirname, '../../packages/validation/src/index.ts'),
      '@vytches/ddd-value-objects': resolve(__dirname, '../../packages/value-objects/src/index.ts'),
      '@vytches/ddd-testing': resolve(__dirname, '../../packages/testing/src/index.ts'),
      '@vytches/ddd-domain-primitives': resolve(
        __dirname,
        '../../packages/domain-primitives/src/index.ts'
      ),
      '@vytches/ddd-logging': resolve(__dirname, '../../packages/logging/src/index.ts'),
      '@vytches/ddd-utils': resolve(__dirname, '../../packages/utils/src/index.ts'),
      '@vytches/ddd': resolve(__dirname, '../../packages/enterprise/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
