import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import type { IDependencyContainer } from '@vytches/ddd-di';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../../src';
import { EnhancedCommandBus, EnhancedQueryBus } from '../../src';

/**
 * D13 + AC1 — contract tests for the `retry`/`BusRetryOptions` shape shared
 * by `EnhancedCommandBus` and `EnhancedQueryBus`.
 *
 * LT1/N1: imports the package's own public barrel via '../../src'
 * (`packages/cqrs/src/index.ts` — the exact file '@vytches/ddd-cqrs'
 * resolves to), not an internal subpath. This repo's
 * `@nx/enforce-module-boundaries` lint rule rejects a project importing its
 * own package name from within itself, so a same-project contract test
 * cannot literally spell '@vytches/ddd-cqrs' the way a cross-package
 * consumer test does (see tests/api-surface.test.ts and
 * tests/symbol-tokens.test.ts for the same established pattern).
 *
 * `tests/api-surface.test.ts` snapshots `Object.keys(api)`, which is blind
 * to this change: `retry.jitter`'s default flipping from the (buggy)
 * hardcoded `false` to `true` adds no new export, so that snapshot stays
 * green either way (D13). These tests instead assert the *behavior* the
 * default now produces.
 */

class TestCommand implements ICommand {}
class TestCommandHandler implements ICommandHandler<TestCommand> {
  async execute(): Promise<void> {
    throw new Error('always fails');
  }
}

class TestQuery implements IQuery<string> {}
class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(): Promise<string> {
    throw new Error('always fails');
  }
}

function fakeContainer(): IDependencyContainer {
  return {
    resolve: vi.fn(),
    register: vi.fn(),
    registerInstance: vi.fn(),
    registerFactory: vi.fn(),
    isRegistered: vi.fn(),
    dispose: vi.fn(),
    getServices: vi.fn(),
    createScope: vi.fn(),
    getServicesByTag: vi.fn(),
  } as unknown as IDependencyContainer;
}

describe('BusRetryOptions default jitter (D13)', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // RetryPolicy.calculateDelay() only calls Math.random() when
    // `config.jitter` is truthy (Equal Jitter algorithm, see
    // packages/resilience/src/patterns/retry.ts). Spying on the global is a
    // behavioral observation, not a mock of this package's own internals —
    // it is the only externally-observable signal that jitter is active,
    // since RetryStrategy/RetryPolicy keep their config private with no
    // getter (OUT OF SCOPE per the task card: no new introspection API).
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('EnhancedCommandBus: retry enabled without an explicit jitter setting applies jitter by default', async () => {
    const bus = new EnhancedCommandBus(fakeContainer(), {
      resilience: {
        // No `jitter` field — must default to true (was hardcoded `false`
        // pre-fix, SA-H3).
        retry: { enabled: true, maxAttempts: 2, baseDelay: 5, maxDelay: 20 },
      },
    });
    bus.register(TestCommand, new TestCommandHandler());

    await safeRun(() => bus.execute(new TestCommand()));

    expect(randomSpy).toHaveBeenCalled();
  });

  it('EnhancedQueryBus: retry enabled without an explicit jitter setting applies jitter by default', async () => {
    const bus = new EnhancedQueryBus(fakeContainer(), {
      resilience: {
        retry: { enabled: true, maxAttempts: 2, baseDelay: 5, maxDelay: 20 },
      },
    });
    bus.register(TestQuery, new TestQueryHandler());

    await safeRun(() => bus.execute(new TestQuery()));

    expect(randomSpy).toHaveBeenCalled();
  });

  it('EnhancedCommandBus: an explicit jitter: false override is still honored (no behavior change to the algorithm itself, D4/D8)', async () => {
    const bus = new EnhancedCommandBus(fakeContainer(), {
      resilience: {
        retry: { enabled: true, maxAttempts: 2, baseDelay: 5, maxDelay: 20, jitter: false },
      },
    });
    bus.register(TestCommand, new TestCommandHandler());

    await safeRun(() => bus.execute(new TestCommand()));

    expect(randomSpy).not.toHaveBeenCalled();
  });
});

describe('BusRetryOptions boolean/object normalization (AC1, OQ4)', () => {
  it('retry: true (legacy boolean) and retry: { enabled: true } produce the same outcome on EnhancedCommandBus', async () => {
    const errorHandler = new TestCommandHandler();

    const boolBus = new EnhancedCommandBus(fakeContainer(), {
      resilience: { retry: true },
    });
    boolBus.register(TestCommand, errorHandler);

    const objectBus = new EnhancedCommandBus(fakeContainer(), {
      resilience: { retry: { enabled: true } },
    });
    objectBus.register(TestCommand, errorHandler);

    await safeRun(() => boolBus.execute(new TestCommand()));
    await safeRun(() => objectBus.execute(new TestCommand()));

    // Both forms enable retry with the bus's default maxRetries (3) — same
    // number of attempts recorded as errors either way.
    expect(boolBus.getMetrics().errors).toBe(objectBus.getMetrics().errors);
    expect(boolBus.getMetrics().errors).toBeGreaterThan(1);
  }, 15000);

  it('retry: true (legacy boolean) and retry: { enabled: true } produce the same outcome on EnhancedQueryBus', async () => {
    const errorHandler = new TestQueryHandler();

    const boolBus = new EnhancedQueryBus(fakeContainer(), {
      resilience: { retry: true },
    });
    boolBus.register(TestQuery, errorHandler);

    const objectBus = new EnhancedQueryBus(fakeContainer(), {
      resilience: { retry: { enabled: true } },
    });
    objectBus.register(TestQuery, errorHandler);

    await safeRun(() => boolBus.execute(new TestQuery()));
    await safeRun(() => objectBus.execute(new TestQuery()));

    expect(boolBus.getMetrics().errors).toBe(objectBus.getMetrics().errors);
    expect(boolBus.getMetrics().errors).toBeGreaterThan(1);
  }, 15000);

  it('retry object without an `enabled` field is disabled, identically on both buses (OQ4)', async () => {
    const commandBus = new EnhancedCommandBus(fakeContainer(), {
      resilience: { retry: { maxAttempts: 5, baseDelay: 5 } },
    });
    commandBus.register(TestCommand, new TestCommandHandler());

    const queryBus = new EnhancedQueryBus(fakeContainer(), {
      resilience: { retry: { maxAttempts: 5, baseDelay: 5 } },
    });
    queryBus.register(TestQuery, new TestQueryHandler());

    await safeRun(() => commandBus.execute(new TestCommand()));
    await safeRun(() => queryBus.execute(new TestQuery()));

    // Disabled retry: exactly one attempt, on both buses — not 5.
    expect(commandBus.getMetrics().errors).toBe(1);
    expect(queryBus.getMetrics().errors).toBe(1);
  });
});
