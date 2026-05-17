import { describe, it, expect, vi } from 'vitest';
import type { IDependencyContainer } from '@vytches/ddd-di';

import { CQRSModule } from '../../src/configuration/cqrs-module';
import { CQRSConfiguration } from '../../src/configuration/cqrs-configuration';
import { CommandBus, EnhancedCommandBus, EnhancedQueryBus, QueryBus } from '../../src/implementations';

const fakeContainer: IDependencyContainer = {
  resolve: vi.fn(),
  register: vi.fn(),
  registerFactory: vi.fn(),
  registerInstance: vi.fn(),
  isRegistered: vi.fn(),
  getServices: vi.fn(() => []),
  getServicesByTag: vi.fn(() => []),
} as unknown as IDependencyContainer;

describe('CQRSModule.create', () => {
  it('returns a CQRSConfiguration with provided options', () => {
    const cqrs = CQRSModule.create(fakeContainer, { commandBusType: 'enhanced' });
    expect(cqrs).toBeInstanceOf(CQRSConfiguration);
    expect(cqrs.commandBus).toBeInstanceOf(EnhancedCommandBus);
    expect(cqrs.queryBus).toBeInstanceOf(QueryBus);
  });

  it('uses defaults when options are omitted', () => {
    const cqrs = CQRSModule.create(fakeContainer);
    expect(cqrs.commandBus).toBeInstanceOf(CommandBus);
    expect(cqrs.queryBus).toBeInstanceOf(QueryBus);
  });
});

describe('CQRSModule.createBasic', () => {
  it('creates basic command and query buses regardless of caller', () => {
    const cqrs = CQRSModule.createBasic(fakeContainer);
    expect(cqrs).toBeInstanceOf(CQRSConfiguration);
    expect(cqrs.commandBus).toBeInstanceOf(CommandBus);
    expect(cqrs.queryBus).toBeInstanceOf(QueryBus);
  });
});

describe('CQRSModule.createEnhanced', () => {
  it('creates enhanced command and query buses', () => {
    const cqrs = CQRSModule.createEnhanced(fakeContainer);
    expect(cqrs).toBeInstanceOf(CQRSConfiguration);
    expect(cqrs.commandBus).toBeInstanceOf(EnhancedCommandBus);
    expect(cqrs.queryBus).toBeInstanceOf(EnhancedQueryBus);
  });
});
