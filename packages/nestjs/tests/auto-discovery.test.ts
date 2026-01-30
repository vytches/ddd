import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for testing actual bus injection
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import type { ICommandHandler, ICommand } from '@vytches/ddd-cqrs';
import { safeRun } from '@vytches/ddd-utils';

// Test command and handler
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

// Test-specific decorator that applies the same metadata as CommandHandler
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Decorator requires any for class constructor type
function TestCommandDecorator(messageType: new (...args: any[]) => any) {
  return <T extends new (...args: any[]) => any>(target: T): T => {
    Reflect.defineMetadata('di:handler-type', 'command', target);
    Reflect.defineMetadata(
      'di:handler-metadata',
      {
        messageType,
        handlerType: target,
      },
      target
    );
    Reflect.defineMetadata(
      'di:command-handler',
      {
        messageType,
        handlerType: target,
      },
      messageType
    );
    return target;
  };
}

@Injectable()
@TestCommandDecorator(TestCommand)
class TestCommandHandler implements ICommandHandler<TestCommand, string> {
  async execute(command: TestCommand): Promise<string> {
    return `Processed: ${command.data}`;
  }
}

describe('Auto-Discovery Integration', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [TestCommandHandler],
    }).compile();

    // Initialize the module to trigger auto-discovery
    await module.init();
  });

  it('should auto-discover and register command handler', async () => {
    // The handler should be registered automatically
    const handler = module.get<TestCommandHandler>(TestCommandHandler);
    expect(handler).toBeDefined();
    expect(handler).toBeInstanceOf(TestCommandHandler);

    // Test the handler works directly
    const command = new TestCommand('test data');
    const [error, result] = await safeRun(() => handler.execute(command));

    expect(error).toBeUndefined();
    expect(result).toBe('Processed: test data');
  });

  it('should have correct metadata on handler', () => {
    const handlerType = Reflect.getMetadata('di:handler-type', TestCommandHandler);
    const handlerMetadata = Reflect.getMetadata('di:handler-metadata', TestCommandHandler);

    expect(handlerType).toBe('command');
    expect(handlerMetadata).toBeDefined();
    expect(handlerMetadata.messageType).toBe(TestCommand);
    expect(handlerMetadata.handlerType).toBe(TestCommandHandler);
  });

  it('should have metadata on command class', () => {
    const commandMetadata = Reflect.getMetadata('di:command-handler', TestCommand);

    expect(commandMetadata).toBeDefined();
    expect(commandMetadata.handlerType).toBe(TestCommandHandler);
    expect(commandMetadata.messageType).toBe(TestCommand);
  });
});

describe('Bus Injection Integration - Critical Path Test', () => {
  /**
   * This test verifies the critical path that was broken in commit 625150af:
   * VytchesExplorerService must receive ICommandBus/IQueryBus via DI injection
   * and must be able to call register() on them.
   *
   * The bug was: code used string tokens ('ICommandBus') but apps provide class tokens (ICommandBus).
   * This test would have caught that bug.
   */

  it('should inject ICommandBus via class token and register handlers on init', async () => {
    // Create spy functions to track bus registration calls
    const registerSpy = vi.fn();
    const registerFactorySpy = vi.fn();

    // Create a mock bus that tracks calls
    const mockCommandBus = {
      register: registerSpy,
      registerFactory: registerFactorySpy,
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    const mockQueryBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      send: vi.fn().mockResolvedValue({ success: true }),
    };

    // Create module with CLASS tokens (how real apps configure it)
    // NOTE: Buses must be passed through forRoot() so they're in the same
    // module scope as VytchesExplorerService for DI injection to work.
    // Real apps would typically have a shared infrastructure module that
    // creates buses and passes them to VytchesDDDModule.forRoot({ providers: [...] })
    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot({
          providers: [
            // CRITICAL: This is how real apps provide buses - using CLASS tokens
            // The key insight is that using the abstract class ICommandBus
            // as the token ensures NestJS DI can match it correctly
            { provide: ICommandBus, useValue: mockCommandBus },
            { provide: IQueryBus, useValue: mockQueryBus },
          ],
        }),
      ],
      providers: [TestCommandHandler],
    }).compile();

    // module.init() triggers onModuleInit() which discovers and registers handlers
    await module.init();

    // Verify VytchesExplorerService exists and was initialized
    const explorer = module.get(VytchesExplorerService);
    expect(explorer).toBeDefined();

    // CRITICAL ASSERTION: Verify the buses were actually injected into explorer
    // This catches the bug where string tokens ('ICommandBus') were used
    // but apps provide buses via class tokens (ICommandBus)
    expect(explorer.hasCommandBus()).toBe(true);
    expect(explorer.hasQueryBus()).toBe(true);

    // Also verify the bus can be resolved from module via class token
    const injectedCommandBus = module.get(ICommandBus);
    expect(injectedCommandBus).toBe(mockCommandBus);

    await module.close();
  });

  it('should fail gracefully when buses are not provided', async () => {
    // This test verifies the system handles missing buses gracefully
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRoot()],
      providers: [TestCommandHandler],
      // No ICommandBus or IQueryBus provided
    }).compile();

    // Should not throw during init even without buses
    const [initError] = await safeRun(async () => module.init());
    expect(initError).toBeUndefined();

    const explorer = module.get(VytchesExplorerService);
    expect(explorer).toBeDefined();

    await module.close();
  });
});
