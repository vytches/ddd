/**
 * Resolve-overhead benchmarks for SimpleContainer.
 *
 * Metric: µs/op — how long a single resolve() call takes on a warmed container.
 *
 * Two lifetimes are measured:
 *   - Singleton  → the second+ call hits the singletonInstances Map (O(1)).
 *   - Transient  → every call instantiates via `new`, no cache involved.
 *
 * Baseline reference: benchmarks/baseline.json
 *
 * SLO (library-isolated, node process, no NestJS):
 *   singleton resolve  < 1 µs/op
 *   transient resolve  < 2 µs/op
 *
 * Run: pnpm --filter @vytches/ddd-di bench
 */
import { bench, describe } from 'vitest';
import { SimpleContainer } from '../src/containers/simple-container';
import { ServiceLifetime } from '../src/types';

// ---------------------------------------------------------------------------
// Fixtures — minimal, allocation-free service implementations
// ---------------------------------------------------------------------------

class NoopService {
  greet(): string {
    return 'ok';
  }
}

// ---------------------------------------------------------------------------
// Singleton resolve overhead
// ---------------------------------------------------------------------------

describe('SimpleContainer.resolve — singleton', () => {
  const container = new SimpleContainer();

  container.register(NoopService, NoopService, { lifetime: ServiceLifetime.Singleton });

  // Warm: trigger singleton caching before measurement begins
  container.resolve(NoopService);

  bench(
    'warmed singleton resolve',
    () => {
      container.resolve(NoopService);
    },
    { warmupIterations: 100, iterations: 1000 }
  );
});

// ---------------------------------------------------------------------------
// Transient resolve overhead
// ---------------------------------------------------------------------------

describe('SimpleContainer.resolve — transient', () => {
  const container = new SimpleContainer();

  container.register(NoopService, NoopService, { lifetime: ServiceLifetime.Transient });

  // One warm-up call to populate tokenKeyCache (memoised in D-2/B)
  container.resolve(NoopService);

  bench(
    'warmed transient resolve',
    () => {
      container.resolve(NoopService);
    },
    { warmupIterations: 100, iterations: 1000 }
  );
});

// ---------------------------------------------------------------------------
// String-token resolve (common real-world usage pattern)
// ---------------------------------------------------------------------------

describe('SimpleContainer.resolve — string token', () => {
  const TOKEN = 'INoopService';
  const container = new SimpleContainer();

  container.registerFactory<NoopService>(TOKEN, () => new NoopService(), {
    lifetime: ServiceLifetime.Singleton,
  });

  container.resolve<NoopService>(TOKEN);

  bench(
    'warmed singleton resolve via string token',
    () => {
      container.resolve<NoopService>(TOKEN);
    },
    { warmupIterations: 100, iterations: 1000 }
  );
});
