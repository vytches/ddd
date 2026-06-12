/**
 * Tests for VP-009 Bug #2: GLOBAL_QUERY_BUS / GLOBAL_COMMAND_BUS tokens
 * for cross-context ACL access to the root bus instance.
 *
 * Core problem: VytchesDDDModule.forFeature() shadows ICommandBus and IQueryBus
 * with feature-scoped instances inside the importing module. ACL services that
 * need to dispatch to the root context (cross-context communication) have no
 * stable token that resolves to the root bus regardless of scoping.
 *
 * Solution: GLOBAL_QUERY_BUS and GLOBAL_COMMAND_BUS are provided only by
 * forRoot(). forFeature() intentionally does NOT provide them, so NestJS
 * resolves injection upward to the global module — always the root instance.
 *
 * Symmetry:
 *   LOCAL_EVENT_BUS  → feature-local event bus  (provided by forFeature())
 *   GLOBAL_QUERY_BUS → root query bus           (provided by forRoot() only)
 *   GLOBAL_COMMAND_BUS → root command bus       (provided by forRoot() only)
 *
 * Coverage:
 *   CT-1: GLOBAL_QUERY_BUS / GLOBAL_COMMAND_BUS are exported from @vytches/ddd-nestjs and are symbols
 *   CT-2: Symbol.for interning — same key always returns the same symbol
 *   CT-3 (RED→GREEN): with forFeature() active (feature IQueryBus shadowed),
 *         GLOBAL_QUERY_BUS resolves to the root instance, not the feature one
 *   Pitfall 5 (tolerance): when no bus is configured, GLOBAL_* resolves to
 *         undefined without crashing the module
 */
import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Inject, Injectable } from '@nestjs/common';

import { GLOBAL_QUERY_BUS, GLOBAL_COMMAND_BUS } from '../../src/constants';
import { VytchesDDDModule } from '../../src/vytches-ddd.module';
import { VytchesDDDFeatureModule } from '../../src/feature/vytches-ddd-feature.module';

// ─── Shared mocks (hoisted so they are available to vi.mock factories) ───────

const { MockICommandBus, MockIQueryBus } = vi.hoisted(() => {
  abstract class MockICommandBus {
    abstract register(commandType: unknown, handler: unknown): void;
    abstract registerFactory(commandType: unknown, factory: unknown): void;
    abstract execute(command: unknown): Promise<unknown>;
  }

  abstract class MockIQueryBus {
    abstract register(queryType: unknown, handler: unknown): void;
    abstract registerFactory(queryType: unknown, factory: unknown): void;
    abstract send(query: unknown): Promise<unknown>;
  }

  return { MockICommandBus, MockIQueryBus };
});

vi.mock('@vytches/ddd-cqrs', () => {
  class CommandBus {
    register = vi.fn();
    registerFactory = vi.fn();
    execute = vi.fn();
  }
  class QueryBus {
    register = vi.fn();
    registerFactory = vi.fn();
    send = vi.fn();
  }
  return {
    ICommandBus: MockICommandBus,
    IQueryBus: MockIQueryBus,
    CommandBus,
    QueryBus,
    // Symbol tokens must match the real package so forRoot() bridge providers
    // and VytchesExplorerService @Inject decorators resolve correctly.
    COMMAND_BUS_TOKEN: Symbol.for('vytches:cqrs:command-bus'),
    QUERY_BUS_TOKEN: Symbol.for('vytches:cqrs:query-bus'),
  };
});

vi.mock('@vytches/ddd-events', () => {
  class UnifiedEventBus {
    publish = vi.fn();
    subscribe = vi.fn();
    registerHandler = vi.fn();
  }
  return { UnifiedEventBus };
});

// ─── CT-1: Export and type assertions ────────────────────────────────────────

describe('CT-1: GLOBAL_QUERY_BUS / GLOBAL_COMMAND_BUS exports', () => {
  it('GLOBAL_QUERY_BUS is exported and is a symbol', () => {
    expect(typeof GLOBAL_QUERY_BUS).toBe('symbol');
  });

  it('GLOBAL_COMMAND_BUS is exported and is a symbol', () => {
    expect(typeof GLOBAL_COMMAND_BUS).toBe('symbol');
  });
});

// ─── CT-2: Symbol.for interning ───────────────────────────────────────────────

describe('CT-2: Symbol.for interning', () => {
  it('GLOBAL_QUERY_BUS === Symbol.for("vytches:global-query-bus")', () => {
    expect(GLOBAL_QUERY_BUS).toBe(Symbol.for('vytches:global-query-bus'));
  });

  it('GLOBAL_COMMAND_BUS === Symbol.for("vytches:global-command-bus")', () => {
    expect(GLOBAL_COMMAND_BUS).toBe(Symbol.for('vytches:global-command-bus'));
  });

  it('both tokens survive round-trip through Symbol.for registry', () => {
    // Simulates the dual-package loading scenario: same key → same symbol
    const rehydratedQuery = Symbol.for(Symbol.keyFor(GLOBAL_QUERY_BUS) as string);
    const rehydratedCommand = Symbol.for(Symbol.keyFor(GLOBAL_COMMAND_BUS) as string);
    expect(rehydratedQuery).toBe(GLOBAL_QUERY_BUS);
    expect(rehydratedCommand).toBe(GLOBAL_COMMAND_BUS);
  });
});

// ─── CT-3: forFeature() shadows IQueryBus but GLOBAL_QUERY_BUS stays root ────

describe('CT-3 (RED→GREEN): GLOBAL_QUERY_BUS resolves to root instance when forFeature() is active', () => {
  it('GLOBAL_QUERY_BUS resolves to root IQueryBus, not the feature-scoped one', async () => {
    // The root query bus instance — this is what GLOBAL_QUERY_BUS must resolve to.
    const rootQueryBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      send: vi.fn().mockResolvedValue({ from: 'root' }),
    };

    // The feature-scoped query bus — overrides IQueryBus within the feature module.
    const featureQueryBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      send: vi.fn().mockResolvedValue({ from: 'feature' }),
    };

    // A consumer service that injects both tokens to demonstrate the distinction.
    @Injectable()
    class AclConsumerService {
      constructor(
        @Inject(MockIQueryBus) public readonly featureScopedBus: typeof featureQueryBus,
        @Inject(GLOBAL_QUERY_BUS) public readonly globalBus: typeof rootQueryBus | undefined
      ) {}
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot({
          providers: [
            // Root IQueryBus — the one GLOBAL_QUERY_BUS should resolve to
            { provide: MockIQueryBus, useValue: rootQueryBus },
          ],
        }),
        // forFeature() shadows IQueryBus in the feature scope
        VytchesDDDFeatureModule.forFeature('orders'),
      ],
      providers: [
        // Feature-scoped override within this test module — simulates what
        // forFeature() injects into the consuming bounded-context module.
        { provide: MockIQueryBus, useValue: featureQueryBus },
        AclConsumerService,
      ],
    }).compile();

    const service = moduleRef.get(AclConsumerService);

    // The feature-scoped IQueryBus is the one from the test module's providers.
    expect(service.featureScopedBus).toBe(featureQueryBus);

    // GLOBAL_QUERY_BUS must resolve to the root bus, not the feature bus.
    expect(service.globalBus).toBeDefined();
    expect(service.globalBus).not.toBe(featureQueryBus);
    expect(service.globalBus).toBe(rootQueryBus);

    await moduleRef.close();
  });

  it('GLOBAL_COMMAND_BUS resolves to root ICommandBus, not the feature-scoped one', async () => {
    const rootCommandBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      execute: vi.fn().mockResolvedValue({ from: 'root' }),
    };

    const featureCommandBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      execute: vi.fn().mockResolvedValue({ from: 'feature' }),
    };

    @Injectable()
    class AclCommandConsumerService {
      constructor(
        @Inject(MockICommandBus) public readonly featureScopedBus: typeof featureCommandBus,
        @Inject(GLOBAL_COMMAND_BUS)
        public readonly globalBus: typeof rootCommandBus | undefined
      ) {}
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot({
          providers: [{ provide: MockICommandBus, useValue: rootCommandBus }],
        }),
        VytchesDDDFeatureModule.forFeature('catalog'),
      ],
      providers: [
        { provide: MockICommandBus, useValue: featureCommandBus },
        AclCommandConsumerService,
      ],
    }).compile();

    const service = moduleRef.get(AclCommandConsumerService);

    expect(service.featureScopedBus).toBe(featureCommandBus);
    expect(service.globalBus).toBeDefined();
    expect(service.globalBus).not.toBe(featureCommandBus);
    expect(service.globalBus).toBe(rootCommandBus);

    await moduleRef.close();
  });
});

// ─── forFeature() does NOT declare GLOBAL_* (structural assertion) ────────────

describe('forFeature() does not declare GLOBAL_QUERY_BUS or GLOBAL_COMMAND_BUS', () => {
  it('GLOBAL_QUERY_BUS is absent from forFeature() providers', () => {
    const mod = VytchesDDDFeatureModule.forFeature('payments');
    const providers = (mod.providers ?? []) as Array<{ provide?: unknown }>;
    const providedTokens = providers.map(p => p.provide);
    expect(providedTokens).not.toContain(GLOBAL_QUERY_BUS);
  });

  it('GLOBAL_COMMAND_BUS is absent from forFeature() providers', () => {
    const mod = VytchesDDDFeatureModule.forFeature('payments');
    const providers = (mod.providers ?? []) as Array<{ provide?: unknown }>;
    const providedTokens = providers.map(p => p.provide);
    expect(providedTokens).not.toContain(GLOBAL_COMMAND_BUS);
  });
});

// ─── Pitfall 5: tolerance when bus is not configured ─────────────────────────

describe('Pitfall 5: GLOBAL_* resolves to undefined without crashing when bus is absent', () => {
  it('module boots without IQueryBus — GLOBAL_QUERY_BUS resolves to undefined', async () => {
    @Injectable()
    class OptionalConsumer {
      constructor(@Inject(GLOBAL_QUERY_BUS) public readonly bus: unknown) {}
    }

    // forRoot() with no bus registered — GLOBAL_QUERY_BUS factory returns undefined
    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRoot()],
      providers: [OptionalConsumer],
    }).compile();

    // Module must compile and boot without throwing
    const consumer = moduleRef.get(OptionalConsumer);
    expect(consumer.bus).toBeUndefined();

    await moduleRef.close();
  });

  it('module boots without ICommandBus — GLOBAL_COMMAND_BUS resolves to undefined', async () => {
    @Injectable()
    class OptionalCommandConsumer {
      constructor(@Inject(GLOBAL_COMMAND_BUS) public readonly bus: unknown) {}
    }

    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRoot()],
      providers: [OptionalCommandConsumer],
    }).compile();

    const consumer = moduleRef.get(OptionalCommandConsumer);
    expect(consumer.bus).toBeUndefined();

    await moduleRef.close();
  });
});
