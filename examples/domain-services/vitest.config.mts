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
      '@vytches/ddd-domain-services': resolve(
        __dirname,
        '../../packages/domain-services/src/index.ts'
      ),
      '@vytches/ddd-events': resolve(__dirname, '../../packages/events/src/index.ts'),
      '@vytches/ddd-utils': resolve(__dirname, '../../packages/utils/src/index.ts'),
      '@vytches/ddd-logging': resolve(__dirname, '../../packages/logging/src/index.ts'),
      '@vytches/ddd-di': resolve(__dirname, '../../packages/di/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
