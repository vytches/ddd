import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    // VB-005 / VF-024 (AC4): array form (not object) — rollup/alias's string
    // `find` does *prefix* matching (matches `X` or `X/...`), so the array is
    // checked in order and first match wins. The `/internal` subpath
    // aliases MUST be listed before their base-package alias, otherwise the
    // base-package entry (e.g. `@vytches/ddd-contracts`) prefix-matches
    // `@vytches/ddd-contracts/internal` first, aliases it to the wrong
    // target, and resolution falls through to real node_modules lookup —
    // which fails under vite-node's SSR external import (ERR_MODULE_NOT_FOUND)
    // because the workspace root's node_modules/@vytches only contains
    // ddd-testing.
    alias: [
      {
        find: '@vytches/ddd-contracts/internal',
        replacement: resolve(__dirname, '../packages/contracts/src/internal.ts'),
      },
      {
        find: '@vytches/ddd-events/internal',
        replacement: resolve(__dirname, '../packages/events/src/internal.ts'),
      },
      {
        find: '@vytches/ddd-aggregates',
        replacement: resolve(__dirname, '../packages/aggregates/src/index.ts'),
      },
      {
        find: '@vytches/ddd-contracts',
        replacement: resolve(__dirname, '../packages/contracts/src/index.ts'),
      },
      {
        find: '@vytches/ddd-domain-primitives',
        replacement: resolve(__dirname, '../packages/domain-primitives/src/index.ts'),
      },
      {
        find: '@vytches/ddd-events',
        replacement: resolve(__dirname, '../packages/events/src/index.ts'),
      },
      {
        find: '@vytches/ddd-utils',
        replacement: resolve(__dirname, '../packages/utils/src/index.ts'),
      },
      {
        find: '@vytches/ddd-value-objects',
        replacement: resolve(__dirname, '../packages/value-objects/src/index.ts'),
      },
      {
        find: '@vytches/ddd-logging',
        replacement: resolve(__dirname, '../packages/logging/src/index.ts'),
      },
    ],
  },
  test: {
    benchmark: {
      include: ['suites/**/*.bench.ts'],
      reporters: ['default'],
    },
  },
});
