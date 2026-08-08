/**
 * A handler that is discovered but has no bus to register on used to be dropped
 * in silence: discovery kept reporting success while every dispatch of that
 * message type failed at runtime. That combination is what turns a DI token
 * mismatch into hours of debugging, so the drop is now announced.
 *
 * VP-009 follow-up.
 */
import 'reflect-metadata';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

class DoSomethingCommand {
  constructor(public readonly value: string) {}
}

@Injectable()
class DoSomethingHandler {
  execute(): Promise<string> {
    return Promise.resolve('done');
  }
}

Reflect.defineMetadata('di:handler-type', 'command', DoSomethingHandler);
Reflect.defineMetadata(
  'di:handler-metadata',
  { messageType: DoSomethingCommand, handlerType: DoSomethingHandler },
  DoSomethingHandler
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VytchesExplorerService — handler discovered without a bus', () => {
  it('warns naming the handler and the missing bus instead of dropping it silently', async () => {
    const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

    // forRoot() with no bus provider anywhere: the bridge provider resolves to
    // undefined, so the explorer has no commandBus.
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRoot()],
      providers: [DoSomethingHandler],
    }).compile();

    await module.init();

    const missingBusWarning = warnSpy.mock.calls.find(([message]) =>
      String(message).includes('no command bus is injected')
    );

    expect(missingBusWarning).toBeDefined();
    expect(missingBusWarning?.[1]).toMatchObject({
      handlerName: 'DoSomethingHandler',
      handlerType: 'command',
      messageType: 'DoSomethingCommand',
    });

    await module.close();
  });

  it('stays quiet when the bus is present', async () => {
    const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [DoSomethingHandler],
    }).compile();

    await module.init();

    const missingBusWarning = warnSpy.mock.calls.find(([message]) =>
      String(message).includes('no command bus is injected')
    );

    expect(missingBusWarning).toBeUndefined();

    await module.close();
  });
});
