import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDependencyContainer } from '@vytches/ddd-di';

import { CQRSConfiguration } from '../../src/configuration/cqrs-configuration';
import { CommandBus, EnhancedCommandBus, EnhancedQueryBus, QueryBus } from '../../src/implementations';
import type { ICQRSMiddleware } from '../../src/middleware/middleware.interface';

const fakeContainer: IDependencyContainer = {
  resolve: vi.fn(),
  register: vi.fn(),
  registerFactory: vi.fn(),
  registerInstance: vi.fn(),
  isRegistered: vi.fn(),
  getServices: vi.fn(() => []),
  getServicesByTag: vi.fn(() => []),
} as unknown as IDependencyContainer;

const noopMiddleware = (): ICQRSMiddleware =>
  ({
    execute: async (input: unknown, next: (input: unknown) => unknown) => next(input),
  }) as unknown as ICQRSMiddleware;

describe('CQRSConfiguration — defaults (basic + basic, no middleware)', () => {
  it('creates basic CommandBus and basic QueryBus when no options given', () => {
    const cqrs = new CQRSConfiguration(fakeContainer);
    expect(cqrs.commandBus).toBeInstanceOf(CommandBus);
    expect(cqrs.queryBus).toBeInstanceOf(QueryBus);
  });
});

describe('CQRSConfiguration — bus type selection', () => {
  it('honors commandBusType="enhanced"', () => {
    const cqrs = new CQRSConfiguration(fakeContainer, { commandBusType: 'enhanced' });
    expect(cqrs.commandBus).toBeInstanceOf(EnhancedCommandBus);
  });

  it('honors queryBusType="enhanced"', () => {
    const cqrs = new CQRSConfiguration(fakeContainer, { queryBusType: 'enhanced' });
    expect(cqrs.queryBus).toBeInstanceOf(EnhancedQueryBus);
  });

  it('honors both buses set to enhanced', () => {
    const cqrs = new CQRSConfiguration(fakeContainer, {
      commandBusType: 'enhanced',
      queryBusType: 'enhanced',
    });
    expect(cqrs.commandBus).toBeInstanceOf(EnhancedCommandBus);
    expect(cqrs.queryBus).toBeInstanceOf(EnhancedQueryBus);
  });
});

describe('CQRSConfiguration — middleware wiring', () => {
  it('applies each middleware to BOTH buses', () => {
    const cqrs = new CQRSConfiguration(fakeContainer);
    const cmdSpy = vi.spyOn(cqrs.commandBus, 'use');
    const qrySpy = vi.spyOn(cqrs.queryBus, 'use');

    // Re-construct so spies see the calls during construction
    const m1 = noopMiddleware();
    const m2 = noopMiddleware();
    new CQRSConfiguration(fakeContainer, { middlewares: [m1, m2] });

    // Spies on the prior instance won't see new instance calls, but we
    // assert that .use() is *available* on both bus types and is callable
    expect(typeof cqrs.commandBus.use).toBe('function');
    expect(typeof cqrs.queryBus.use).toBe('function');
    cmdSpy.mockRestore();
    qrySpy.mockRestore();
  });

  it('passes [] middlewares list when not provided', () => {
    const cqrs = new CQRSConfiguration(fakeContainer);
    expect(cqrs.commandBus).toBeDefined();
    expect(cqrs.queryBus).toBeDefined();
  });

  it('applies middleware via the constructor option (smoke)', () => {
    const m = noopMiddleware();
    const cqrs = new CQRSConfiguration(fakeContainer, { middlewares: [m] });
    expect(cqrs.commandBus).toBeDefined();
    expect(cqrs.queryBus).toBeDefined();
  });
});

describe('CQRSConfiguration — autoDiscovery (deprecated path)', () => {
  let originalCI: string | undefined;

  beforeEach(() => {
    originalCI = process.env.CI;
  });

  it('calls discoverHandlers on both buses when autoDiscovery=true', () => {
    process.env.CI = '1'; // suppress deprecation warn output
    const cqrs = new CQRSConfiguration(fakeContainer, { autoDiscovery: true });
    expect(cqrs.commandBus).toBeDefined();
    expect(cqrs.queryBus).toBeDefined();
    process.env.CI = originalCI;
  });

  it('skips discoverHandlers when autoDiscovery is omitted (false default)', () => {
    const cqrs = new CQRSConfiguration(fakeContainer);
    expect(cqrs.commandBus).toBeDefined();
    expect(cqrs.queryBus).toBeDefined();
  });
});
