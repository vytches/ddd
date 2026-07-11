import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    // VF-024 (AC4): array form (not object) — rollup/alias's string `find`
    // does *prefix* matching (matches `X` or `X/...`), so the array is
    // checked in order and first match wins. The `/internal` subpath alias
    // MUST be listed before its base-package alias, otherwise the
    // base-package entry (`@vytches/ddd-contracts`) prefix-matches
    // `@vytches/ddd-contracts/internal` first and resolution breaks
    // (see root `vitest.config.mts` for the full explanation).
    alias: [
      {
        find: '@vytches/ddd-contracts/internal',
        replacement: resolve(__dirname, '../../packages/contracts/src/internal.ts'),
      },
      {
        find: '@vytches/ddd-contracts',
        replacement: resolve(__dirname, '../../packages/contracts/src/index.ts'),
      },
      {
        find: '@vytches/ddd-domain-primitives',
        replacement: resolve(__dirname, '../../packages/domain-primitives/src/index.ts'),
      },
      {
        find: '@vytches/ddd-domain-services',
        replacement: resolve(__dirname, '../../packages/domain-services/src/index.ts'),
      },
      {
        find: '@vytches/ddd-events',
        replacement: resolve(__dirname, '../../packages/events/src/index.ts'),
      },
      {
        find: '@vytches/ddd-utils',
        replacement: resolve(__dirname, '../../packages/utils/src/index.ts'),
      },
      {
        find: '@vytches/ddd-logging',
        replacement: resolve(__dirname, '../../packages/logging/src/index.ts'),
      },
      {
        find: '@vytches/ddd-di',
        replacement: resolve(__dirname, '../../packages/di/src/index.ts'),
      },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
