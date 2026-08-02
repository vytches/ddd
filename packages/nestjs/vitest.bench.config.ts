/**
 * Vitest benchmark configuration for @vytches/ddd-nestjs (VP-006b / AC5).
 *
 * Run on demand:  pnpm --filter @vytches/ddd-nestjs bench
 *
 * Intentionally separate from the normal test config so benchmarks are
 * NEVER executed during the standard `vitest run` / CI test pass (the nx
 * test target only picks up tests/**\/*.test.ts). Mirrors the structure of
 * packages/di/vitest.bench.config.ts (VP-006 precedent).
 *
 * PRIMARY metrics are COUNT-based (moduleRef.get invocations + throw count,
 * Reflect.getMetadata invocations) — see benchmarks/resolve.bench.ts.
 * Secondary metrics (timing / heap) — see benchmarks/memory.bench.ts.
 * Compare results against benchmarks/baseline.json.
 */
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve workspace peers from src/ without going through dist/ builds.
    // Array form: subpath aliases MUST precede their base-package alias
    // (prefix matching, first match wins) — same rationale as the root
    // vitest.config.mts (VF-024 AC4).
    alias: [
      {
        find: '@vytches/ddd-contracts/internal',
        replacement: resolve(__dirname, '../contracts/src/internal.ts'),
      },
      {
        find: '@vytches/ddd-contracts',
        replacement: resolve(__dirname, '../contracts/src/index.ts'),
      },
      {
        find: '@vytches/ddd-domain-primitives',
        replacement: resolve(__dirname, '../domain-primitives/src/index.ts'),
      },
      {
        find: '@vytches/ddd-di',
        replacement: resolve(__dirname, '../di/src/index.ts'),
      },
      {
        find: '@vytches/ddd-utils',
        replacement: resolve(__dirname, '../utils/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'nestjs-bench',
    environment: 'node',
    // Loads the reflect-metadata polyfill once per bench file (F-C3 rationale
    // in the root vitest.setup.ts) — the adapter reads design:paramtypes.
    setupFiles: [resolve(__dirname, '../../vitest.setup.ts')],
    include: ['benchmarks/**/*.bench.ts'],
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
      reporters: ['default'],
      outputJson: 'benchmarks/results.json',
    },
  },
});
