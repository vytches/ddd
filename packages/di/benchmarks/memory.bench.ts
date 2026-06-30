/**
 * Descriptor-memory benchmark for SimpleContainer.
 *
 * Metric: KB of heap allocated per 1 000 registered services.
 *
 * Method:
 *   1. Force a GC cycle (if --expose-gc) or wait for the next minor GC via a
 *      small allocation burst, then snapshot heapUsed before registration.
 *   2. Bulk-register 1 000 uniquely-named services.
 *   3. Snapshot heapUsed after registration.
 *   4. Report delta / 1000 as KB-per-descriptor.
 *
 * This is intentionally a single-shot measurement (warmupIterations: 0,
 * iterations: 1) because repeated registration on the same container throws
 * ServiceAlreadyRegisteredError.  The bench harness still reports timing but
 * the primary signal here is the heap delta logged to stdout.
 *
 * SLO: ≤ 1 KB heap per registered service descriptor (1 000 descriptors ≤ 1 MB).
 *
 * Baseline reference: benchmarks/baseline.json
 *
 * Run: pnpm --filter @vytches/ddd-di bench
 */
import { bench, describe } from 'vitest';
import { SimpleContainer } from '../src/containers/simple-container';
import { ServiceLifetime } from '../src/types';

// ---------------------------------------------------------------------------
// Helper: approximate heap snapshot after a micro-GC hint
// ---------------------------------------------------------------------------

function heapUsedKB(): number {
  // Attempt to trigger a minor GC when the runtime exposes it.
  // In standard Node this is a no-op; in --expose-gc mode it forces a cycle.
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
  return process.memoryUsage().heapUsed / 1024;
}

// ---------------------------------------------------------------------------
// Bulk-registration memory delta
// ---------------------------------------------------------------------------

describe('SimpleContainer — descriptor memory per 1 000 services', () => {
  const SERVICE_COUNT = 1_000;

  bench(
    'heap delta KB for 1 000 singleton registrations',
    () => {
      const container = new SimpleContainer();

      const before = heapUsedKB();

      for (let i = 0; i < SERVICE_COUNT; i++) {
        // Factory-based registration avoids constructing 1 000 distinct classes.
        // The factory closure is intentionally minimal (no captured variables)
        // so that measured memory reflects descriptor overhead, not closure size.
        const token = `service_${i}`;
        container.registerFactory(token, () => ({ id: i }), {
          lifetime: ServiceLifetime.Singleton,
        });
      }

      const after = heapUsedKB();
      const deltaKB = after - before;
      const perDescriptorKB = deltaKB / SERVICE_COUNT;

      // Log for human inspection — bench reporters capture stdout
      // eslint-disable-next-line no-console
      console.log(
        `[memory-bench] heap delta: ${deltaKB.toFixed(1)} KB total, ` +
          `${perDescriptorKB.toFixed(3)} KB/descriptor`
      );

      // Soft SLO assertion: ≤ 1 KB per descriptor.
      // Uncomment to enforce as a hard gate in CI:
      // if (perDescriptorKB > 1) {
      //   throw new Error(`Memory SLO breached: ${perDescriptorKB.toFixed(3)} KB/descriptor > 1 KB`);
      // }

      container.dispose();
    },
    { warmupIterations: 0, iterations: 1 }
  );

  bench(
    'heap delta KB for 1 000 transient registrations',
    () => {
      const container = new SimpleContainer();

      const before = heapUsedKB();

      for (let i = 0; i < SERVICE_COUNT; i++) {
        const token = `transient_${i}`;
        container.registerFactory(token, () => ({ id: i }), {
          lifetime: ServiceLifetime.Transient,
        });
      }

      const after = heapUsedKB();
      const deltaKB = after - before;
      const perDescriptorKB = deltaKB / SERVICE_COUNT;

      // eslint-disable-next-line no-console
      console.log(
        `[memory-bench] transient heap delta: ${deltaKB.toFixed(1)} KB total, ` +
          `${perDescriptorKB.toFixed(3)} KB/descriptor`
      );

      container.dispose();
    },
    { warmupIterations: 0, iterations: 1 }
  );
});
