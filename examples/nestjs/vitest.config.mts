import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    // Order matters: `find` is a prefix match, so the `/internal` subpath alias
    // has to precede its base package. See examples/quickstart for the full
    // explanation.
    alias: [
      {
        find: '@vytches/ddd-contracts/internal',
        replacement: resolve(__dirname, '../../packages/contracts/src/internal.ts'),
      },
      {
        find: '@vytches/ddd-nestjs',
        replacement: resolve(__dirname, '../../packages/nestjs/src/index.ts'),
      },
      {
        find: '@vytches/ddd-cqrs',
        replacement: resolve(__dirname, '../../packages/cqrs/src/index.ts'),
      },
      {
        find: '@vytches/ddd-events',
        replacement: resolve(__dirname, '../../packages/events/src/index.ts'),
      },
      {
        find: '@vytches/ddd-contracts',
        replacement: resolve(__dirname, '../../packages/contracts/src/index.ts'),
      },
      {
        find: '@vytches/ddd-acl',
        replacement: resolve(__dirname, '../../packages/acl/src/index.ts'),
      },
      {
        find: '@vytches/ddd-di',
        replacement: resolve(__dirname, '../../packages/di/src/index.ts'),
      },
      {
        find: '@vytches/ddd-utils',
        replacement: resolve(__dirname, '../../packages/utils/src/index.ts'),
      },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
