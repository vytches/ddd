import { describe, it, expect, beforeEach } from 'vitest';
import { CommandBus } from './command-bus';
import { QueryBus } from './query-bus';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../interfaces';

// Test command and handler
class TestCommand implements ICommand {
  constructor(public value: string) {}
}

class TestCommandHandler implements ICommandHandler<TestCommand> {
  async execute(_command: TestCommand): Promise<void> {
    // Test implementation
  }
}

// Test query and handler
class TestQuery implements IQuery<string> {
  constructor(public value: string) {}
}

class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    return `Result: ${query.value}`;
  }
}

describe('DI Integration', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(() => {
    // Initialize buses without DI for basic functionality test
    commandBus = new CommandBus(undefined, false); // Disable DI
    queryBus = new QueryBus(undefined, false); // Disable DI
  });

  it('should create CommandBus without DI', () => {
    expect(commandBus).toBeDefined();
  });

  it('should create QueryBus without DI', () => {
    expect(queryBus).toBeDefined();
  });

  it('should register and execute command without DI', async () => {
    const handler = new TestCommandHandler();
    commandBus.register(TestCommand, handler);

    const command = new TestCommand('test');
    await expect(commandBus.execute(command)).resolves.not.toThrow();
  });

  it('should register and execute query without DI', async () => {
    const handler = new TestQueryHandler();
    queryBus.register(TestQuery, handler);

    const query = new TestQuery('test');
    const result = await queryBus.execute(query);
    expect(result).toBe('Result: test');
  });

  it('should create CommandBus with DI enabled but gracefully fallback when DI not available', () => {
    const commandBusWithDI = new CommandBus(undefined, true); // Enable DI
    expect(commandBusWithDI).toBeDefined();
    // Should not throw even if DI package is not available
  });

  it('should create QueryBus with DI enabled but gracefully fallback when DI not available', () => {
    const queryBusWithDI = new QueryBus(undefined, true); // Enable DI
    expect(queryBusWithDI).toBeDefined();
    // Should not throw even if DI package is not available
  });

  it('should discover handlers without DI using direct instantiation fallback', () => {
    expect(() => commandBus.discoverHandlers()).not.toThrow();
    expect(() => queryBus.discoverHandlers()).not.toThrow();
  });
});
