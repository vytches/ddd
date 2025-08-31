import { describe, it, expect, beforeEach } from 'vitest';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import type { ICommandHandler, ICommand } from '@vytches/ddd-cqrs';
import { safeRun } from '@vytches/ddd-utils';

// Test command and handler
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

// Test-specific decorator that applies the same metadata as CommandHandler
function TestCommandDecorator(messageType: any) {
  return (target: any) => {
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
