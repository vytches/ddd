/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AutoDiscoveryService } from '../src/discovery/auto-discovery.service';
import {
  COMMAND_HANDLER_METADATA,
  DOMAIN_SERVICE_METADATA,
  EVENT_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  SAGA_METADATA,
} from '../src/constants';
import type { NestJSContainerAdapter } from '../src/adapters/nestjs-container.adapter';

/**
 * VP-006 (2026-05-09): unit tests for the single-pass / memoized
 * auto-discovery refactor. Verifies:
 *
 * 1. Classes without DDD metadata are skipped entirely (no register* calls)
 * 2. Same class processed twice in one cycle hits memoization fast path
 * 3. reset() clears the cache
 * 4. Metadata-rich classes (multiple DDD decorators) still register all roles
 */

class FakeNestAdapter implements Partial<NestJSContainerAdapter> {
  registerInstance = vi.fn();
  registerCommandHandler = vi.fn();
  registerQueryHandler = vi.fn();
  registerEventHandler = vi.fn();
  registerSaga = vi.fn();
  registerDomainService = vi.fn();
  has = vi.fn().mockReturnValue(false);
  // The internal register* methods that processClass calls go through the
  // container resolve path. Stub it so tests don't require a real DI.
  resolve = vi.fn().mockReturnValue({
    register: vi.fn(),
    registerHandler: vi.fn(),
    subscribe: vi.fn(),
  });
}

describe('AutoDiscoveryService — VP-006 single-pass + memoization', () => {
  let adapter: FakeNestAdapter;
  let service: AutoDiscoveryService;
  let processSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new FakeNestAdapter();
    service = new AutoDiscoveryService(adapter as unknown as NestJSContainerAdapter);
    // Spy to count processClass invocations.
    processSpy = vi.spyOn(service as any, 'processClass');
    // Stub the internal register* methods — these are tested elsewhere via
    // the integration suite. Here we only care about scan/dispatch behavior.
    vi.spyOn(service as any, 'registerDomainService').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'registerCommandHandler').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'registerQueryHandler').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'registerEventHandler').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'registerSaga').mockResolvedValue(undefined);
  });

  it('skips classes with NO metadata keys (fast path)', async () => {
    class PlainClass {}
    await (service as any).processClass(PlainClass);

    expect(adapter.registerCommandHandler).not.toHaveBeenCalled();
    expect(adapter.registerDomainService).not.toHaveBeenCalled();
    expect(adapter.registerQueryHandler).not.toHaveBeenCalled();
    expect(adapter.registerEventHandler).not.toHaveBeenCalled();
    expect(adapter.registerSaga).not.toHaveBeenCalled();
  });

  it('skips classes with ONLY non-DDD metadata (e.g., framework metadata)', async () => {
    class FrameworkInjected {}
    Reflect.defineMetadata('design:paramtypes', [], FrameworkInjected);
    Reflect.defineMetadata('vendor:other-framework', { foo: 'bar' }, FrameworkInjected);

    await (service as any).processClass(FrameworkInjected);

    expect(adapter.registerCommandHandler).not.toHaveBeenCalled();
    expect(adapter.registerDomainService).not.toHaveBeenCalled();
  });

  it('memoizes processed targets — second call short-circuits', async () => {
    class CommandClass {}
    Reflect.defineMetadata(COMMAND_HANDLER_METADATA, { commandType: 'TestCmd' }, CommandClass);

    // Spy on Reflect.getMetadataKeys so we can count keys-scan invocations.
    const getKeysSpy = vi.spyOn(Reflect, 'getMetadataKeys');
    const registerSpy = vi.spyOn(service as any, 'registerCommandHandler');

    await (service as any).processClass(CommandClass);
    await (service as any).processClass(CommandClass); // memoized
    await (service as any).processClass(CommandClass); // memoized

    // Despite 3 invocations, getMetadataKeys runs ONCE.
    expect(getKeysSpy).toHaveBeenCalledTimes(1);
    // And register only happens for the first (real) processing.
    expect(registerSpy).toHaveBeenCalledTimes(1);
    getKeysSpy.mockRestore();
  });

  it('reset() clears memoization — next call rescans', async () => {
    class CommandClass {}
    Reflect.defineMetadata(COMMAND_HANDLER_METADATA, { commandType: 'TestCmd' }, CommandClass);

    const getKeysSpy = vi.spyOn(Reflect, 'getMetadataKeys');

    await (service as any).processClass(CommandClass);
    service.reset();
    await (service as any).processClass(CommandClass);

    // After reset, re-scan happens.
    expect(getKeysSpy).toHaveBeenCalledTimes(2);
    getKeysSpy.mockRestore();
  });

  it('classes with multiple DDD decorators register all roles', async () => {
    // A class that is both a command handler AND a saga (rare but valid).
    class HybridClass {}
    Reflect.defineMetadata(COMMAND_HANDLER_METADATA, { commandType: 'CmdA' }, HybridClass);
    Reflect.defineMetadata(SAGA_METADATA, { name: 'SagaA' }, HybridClass);

    const registerCmd = vi.spyOn(service as any, 'registerCommandHandler');
    const registerSaga = vi.spyOn(service as any, 'registerSaga');

    await (service as any).processClass(HybridClass);

    expect(registerCmd).toHaveBeenCalledOnce();
    expect(registerSaga).toHaveBeenCalledOnce();
  });

  it('preserves register-call order (DomainService → Command → Query → Event → Saga)', async () => {
    class AllDecorators {}
    Reflect.defineMetadata(DOMAIN_SERVICE_METADATA, { name: 'DS' }, AllDecorators);
    Reflect.defineMetadata(COMMAND_HANDLER_METADATA, { name: 'CH' }, AllDecorators);
    Reflect.defineMetadata(QUERY_HANDLER_METADATA, { name: 'QH' }, AllDecorators);
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, { name: 'EH' }, AllDecorators);
    Reflect.defineMetadata(SAGA_METADATA, { name: 'S' }, AllDecorators);

    const calls: string[] = [];
    vi.spyOn(service as any, 'registerDomainService').mockImplementation(async () => {
      calls.push('domain');
    });
    vi.spyOn(service as any, 'registerCommandHandler').mockImplementation(async () => {
      calls.push('command');
    });
    vi.spyOn(service as any, 'registerQueryHandler').mockImplementation(async () => {
      calls.push('query');
    });
    vi.spyOn(service as any, 'registerEventHandler').mockImplementation(async () => {
      calls.push('event');
    });
    vi.spyOn(service as any, 'registerSaga').mockImplementation(async () => {
      calls.push('saga');
    });

    await (service as any).processClass(AllDecorators);

    expect(calls).toEqual(['domain', 'command', 'query', 'event', 'saga']);
  });

  it('returns early on null/undefined targets (no spy noise)', async () => {
    await (service as any).processClass(null);
    await (service as any).processClass(undefined);
    await (service as any).processClass({}); // not a function
    expect(processSpy).toHaveBeenCalledTimes(3);
    expect(adapter.registerCommandHandler).not.toHaveBeenCalled();
  });
});
