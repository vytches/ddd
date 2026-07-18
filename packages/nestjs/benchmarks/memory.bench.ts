/**
 * createScope() memory + timing benchmark for NestJSContainerAdapter
 * (VP-006b / AC4 materiality measurement + AC5 / D-4 secondary metrics).
 *
 * Metric per N ∈ {100, 500, 1000} registered services:
 *   - mean createScope() wall-clock over 1000 scope creations
 *   - retained heap per LIVE scope (all 1000 scopes kept alive during the
 *     measurement window, GC-hinted heapUsed delta / 1000)
 *
 * AC4 / OQ-2 materiality thresholds (from the approved analysis):
 *   - avg additional retained heap per live scope >= 50 KB at N=1000, OR
 *   - mean createScope() >= 0.5 ms at N=1000
 *   → if either is breached, the createScope copy must move to copy-on-write
 *     (preserving VF-030 D5 snapshot semantics). Otherwise the eager copy
 *     stays and the measurement is documented against baseline.json.
 *
 * Single-shot per N (warmupIterations: 0, iterations: 1) — the primary
 * signal is the stdout log, as in packages/di/benchmarks/memory.bench.ts.
 * Run with --expose-gc for stable heap deltas; without it the delta is a
 * best-effort approximation (run 3+ times, take the median).
 *
 * Baseline reference: benchmarks/baseline.json
 *
 * Run: pnpm --filter @vytches/ddd-nestjs bench
 */
import 'reflect-metadata';
import { bench, describe } from 'vitest';
import type { IDependencyContainer } from '@vytches/ddd-di';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ServiceLifetime enum value required at runtime, not lazy-loaded
import { ServiceLifetime } from '@vytches/ddd-di';
import { buildServiceGraph, heapUsedKB, withNodeEnv } from './fixtures/service-graph';

const SCOPE_COUNT = 1000;
const SERVICE_COUNTS = [100, 500, 1000] as const;

describe('NestJSContainerAdapter — createScope ×1000 (heap delta + mean time)', () => {
  for (const serviceCount of SERVICE_COUNTS) {
    bench(
      `createScope ×${SCOPE_COUNT} at N=${serviceCount}`,
      () => {
        const { adapter, roots } = buildServiceGraph({
          serviceCount,
          lifetime: ServiceLifetime.Singleton,
        });

        withNodeEnv('production', () => {
          // Materialize all singletons first — createScope() snapshots BOTH
          // the services Map and the materialized-singleton Map (VF-030 D5),
          // so an empty singleton cache would understate the copy cost.
          for (const root of roots) {
            adapter.resolve(root);
          }

          // Keep every scope alive so the heap delta reflects RETAINED
          // memory per live scope, not transient allocation churn.
          const scopes: IDependencyContainer[] = [];

          const heapBefore = heapUsedKB();
          const started = performance.now();
          for (let i = 0; i < SCOPE_COUNT; i++) {
            scopes.push(adapter.createScope());
          }
          const elapsedMs = performance.now() - started;
          const heapAfter = heapUsedKB();

          const meanMs = elapsedMs / SCOPE_COUNT;
          const retainedKBPerScope = (heapAfter - heapBefore) / SCOPE_COUNT;
          // eslint-disable-next-line no-console
          console.log(
            `[nestjs-bench] createScope N=${serviceCount} ×${SCOPE_COUNT}: ` +
              `mean=${meanMs.toFixed(4)} ms/scope, retained=${retainedKBPerScope.toFixed(2)} KB/scope ` +
              `(AC4 materiality at N=1000: mean >= 0.5 ms OR retained >= 50 KB)`
          );

          // Release the scopes; keep the array referenced until AFTER the
          // post-measurement so the delta above cannot be GC-skewed.
          scopes.length = 0;
        });
      },
      { warmupIterations: 0, iterations: 1 }
    );
  }
});
