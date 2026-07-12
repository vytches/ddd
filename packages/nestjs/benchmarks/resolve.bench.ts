/**
 * Resolve benchmarks for NestJSContainerAdapter (VP-006b / AC5 / D-4).
 *
 * PRIMARY metrics are COUNT-based (logged to stdout, captured by the bench
 * reporter), not wall-clock:
 *   - moduleRef.get invocations + throw count per resolve scenario
 *     (registry-first resolution, OQ-1/A: internally-owned tokens must not
 *     touch the NestJS container on the production hot path)
 *   - Reflect.getMetadata invocations
 *     (lazy-once reflection cache, D-1: exactly 1 per constructor cold,
 *     exactly 0 warm)
 *
 * SECONDARY metrics: cold deep-graph first resolve and warm resolve timing.
 * NestJS app bootstrap wall-clock is deliberately NOT measured (D-4).
 *
 * Count expectations at N = 100 services (chains of depth 3-5):
 *   cold, NODE_ENV=production : moduleRef.get = 0,   throws = 0,   getMetadata = 100
 *   cold, NODE_ENV=development: moduleRef.get = 100, throws = 100, getMetadata = 100
 *     (dev-only dual-registration divergence guard probes each token ONCE)
 *   warm ×1000, production    : all deltas = 0 (paramtypes cached, registry-first)
 *
 * Baseline reference: benchmarks/baseline.json
 *
 * Run: pnpm --filter @vytches/ddd-nestjs bench
 */
import 'reflect-metadata';
import type { ModuleRef } from '@nestjs/core';
import { bench, describe } from 'vitest';
import { ServiceLifetime } from '@vytches/ddd-di';
import { NestJSContainerAdapter } from '../src/adapters/nestjs-container.adapter';
import { CountingModuleRef } from './fixtures/counting-module-ref';
import {
  buildServiceGraph,
  withNodeEnv,
  withReflectMetadataCounter,
} from './fixtures/service-graph';

const N = 100;

// ---------------------------------------------------------------------------
// (a) Cold first-resolve of a deep graph — count-based primary metrics
// ---------------------------------------------------------------------------

describe('NestJSContainerAdapter — cold deep-graph first resolve (counts)', () => {
  bench(
    `cold resolve of ${N} services (production hot path)`,
    () => {
      // Fresh classes per run → module-level paramtypes cache is COLD.
      const { adapter, moduleRef, roots } = buildServiceGraph({
        serviceCount: N,
        lifetime: ServiceLifetime.Singleton,
      });

      withNodeEnv('production', () => {
        withReflectMetadataCounter(getMetadataCount => {
          for (const root of roots) {
            adapter.resolve(root);
          }
          // eslint-disable-next-line no-console
          console.log(
            `[nestjs-bench] cold N=${N} (production): ` +
              `moduleRef.get=${moduleRef.counts.get} throws=${moduleRef.counts.throws} ` +
              `Reflect.getMetadata=${getMetadataCount()} ` +
              `(expected: get=0 throws=0 getMetadata=${N})`
          );
        });
      });
    },
    { warmupIterations: 0, iterations: 1 }
  );

  bench(
    `cold resolve of ${N} services (dev mode — one-time divergence probe per token)`,
    () => {
      const { adapter, moduleRef, roots } = buildServiceGraph({
        serviceCount: N,
        lifetime: ServiceLifetime.Singleton,
      });

      withNodeEnv('development', () => {
        withReflectMetadataCounter(getMetadataCount => {
          for (const root of roots) {
            adapter.resolve(root);
          }
          // eslint-disable-next-line no-console
          console.log(
            `[nestjs-bench] cold N=${N} (development): ` +
              `moduleRef.get=${moduleRef.counts.get} throws=${moduleRef.counts.throws} ` +
              `Reflect.getMetadata=${getMetadataCount()} ` +
              `(expected: get=${N} throws=${N} getMetadata=${N} — dev guard probes once per token)`
          );
        });
      });
    },
    { warmupIterations: 0, iterations: 1 }
  );
});

// ---------------------------------------------------------------------------
// (b) Warm resolve — count DELTAS must be zero
// ---------------------------------------------------------------------------

describe('NestJSContainerAdapter — warm resolve count deltas', () => {
  bench(
    'warm transient deep-chain resolve ×1000 (production) — zero-delta check',
    () => {
      // Transient lifetime → every resolve re-instantiates the whole chain
      // through createInstance(); only the reflection cache and the
      // registry-first path keep the counters flat.
      const { adapter, moduleRef, roots } = buildServiceGraph({
        serviceCount: 5,
        lifetime: ServiceLifetime.Transient,
        depths: [5],
      });
      const root = roots[0]!;

      withNodeEnv('production', () => {
        withReflectMetadataCounter(getMetadataCount => {
          adapter.resolve(root); // cold pass populates the paramtypes cache

          const coldGetMetadata = getMetadataCount();
          const coldModuleRef = moduleRef.counts;

          for (let i = 0; i < 1000; i++) {
            adapter.resolve(root);
          }

          const metadataDelta = getMetadataCount() - coldGetMetadata;
          const getDelta = moduleRef.counts.get - coldModuleRef.get;
          const throwDelta = moduleRef.counts.throws - coldModuleRef.throws;
          // eslint-disable-next-line no-console
          console.log(
            `[nestjs-bench] warm transient depth-5 ×1000 (production) deltas: ` +
              `moduleRef.get=${getDelta} throws=${throwDelta} Reflect.getMetadata=${metadataDelta} ` +
              `(expected: all 0)`
          );
        });
      });
    },
    { warmupIterations: 0, iterations: 1 }
  );
});

// ---------------------------------------------------------------------------
// ModuleRef fallback path — tokens the adapter does NOT own
// ---------------------------------------------------------------------------

describe('NestJSContainerAdapter — moduleRef fallback counts', () => {
  bench(
    'resolve of a NestJS-owned token (internal miss → moduleRef hit)',
    () => {
      const moduleRef = new CountingModuleRef();
      const nestOnlyToken = 'NEST_ONLY_SERVICE';
      moduleRef.addProvider(nestOnlyToken, { source: 'nest' });
      const adapter = new NestJSContainerAdapter(moduleRef as unknown as ModuleRef);

      adapter.resolve(nestOnlyToken);
      // eslint-disable-next-line no-console
      console.log(
        `[nestjs-bench] nest-owned token: moduleRef.get=${moduleRef.counts.get} ` +
          `throws=${moduleRef.counts.throws} (expected: get=1 throws=0)`
      );
    },
    { warmupIterations: 0, iterations: 1 }
  );

  bench(
    'resolve of an unknown token (internal miss → moduleRef throw → not-found)',
    () => {
      const moduleRef = new CountingModuleRef();
      const adapter = new NestJSContainerAdapter(moduleRef as unknown as ModuleRef);

      try {
        adapter.resolve('COMPLETELY_UNKNOWN');
      } catch {
        // Expected: ContainerServiceNotFoundError — the metric is the count.
      }
      // eslint-disable-next-line no-console
      console.log(
        `[nestjs-bench] unknown token: moduleRef.get=${moduleRef.counts.get} ` +
          `throws=${moduleRef.counts.throws} (expected: get=1 throws=1 — single pass, no double lookup)`
      );
    },
    { warmupIterations: 0, iterations: 1 }
  );
});

// ---------------------------------------------------------------------------
// Secondary: warm resolve timing (µs/op) — mirrors di resolve.bench.ts
// ---------------------------------------------------------------------------

describe('NestJSContainerAdapter — warm resolve timing', () => {
  const singletonFixture = buildServiceGraph({
    serviceCount: N,
    lifetime: ServiceLifetime.Singleton,
  });
  const singletonRoot = singletonFixture.roots[0]!;
  // Warm: materialize singletons + populate paramtypes cache + spend the
  // one-time dev divergence probes before measurement begins.
  for (const root of singletonFixture.roots) {
    singletonFixture.adapter.resolve(root);
  }

  bench(
    'warmed singleton root resolve',
    () => {
      singletonFixture.adapter.resolve(singletonRoot);
    },
    { warmupIterations: 100, iterations: 1000 }
  );

  const transientFixture = buildServiceGraph({
    serviceCount: 5,
    lifetime: ServiceLifetime.Transient,
    depths: [5],
  });
  const transientRoot = transientFixture.roots[0]!;
  transientFixture.adapter.resolve(transientRoot);

  bench(
    'warmed transient depth-5 chain resolve',
    () => {
      transientFixture.adapter.resolve(transientRoot);
    },
    { warmupIterations: 100, iterations: 1000 }
  );
});
