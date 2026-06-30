/**
 * Vitest benchmark configuration for @vytches/ddd-di.
 *
 * Run on demand:  pnpm --filter @vytches/ddd-di bench
 *
 * Intentionally separate from the normal test config so benchmarks are
 * NEVER executed during the standard `vitest run` / CI test pass.
 * They serve as a permanent regression gate: run them locally or in a
 * dedicated CI job and compare results against benchmarks/baseline.json.
 */
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace peers without going through dist/ build
      '@vytches/ddd-contracts': resolve(__dirname, '../contracts/src/index.ts'),
      '@vytches/ddd-domain-primitives': resolve(__dirname, '../domain-primitives/src/index.ts'),
    },
  },
  test: {
    name: 'di-bench',
    environment: 'node',
    include: ['benchmarks/**/*.bench.ts'],
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
      reporters: ['default'],
      outputJson: 'benchmarks/results.json',
    },
  },
});
