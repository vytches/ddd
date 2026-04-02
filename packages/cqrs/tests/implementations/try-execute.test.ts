import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import type { IDependencyContainer } from '@vytches/ddd-di';
import { CommandBus, QueryBus } from '../../src';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../../src';

class TestCommand implements ICommand {
  constructor(public readonly value = 'ok') {}
}

class TestCommandHandler implements ICommandHandler<TestCommand, string> {
  async execute(command: TestCommand): Promise<string> {
    return command.value;
  }
}

class TestQuery implements IQuery<string> {
  constructor(public readonly value = 'result') {}
}

class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    return query.value;
  }
}

function makeContainer(): IDependencyContainer {
  return {
    resolve: vi.fn().mockImplementation(() => {
      throw new Error('not found');
    }),
  } as unknown as IDependencyContainer;
}

describe('CommandBus.tryExecute', () => {
  let commandBus: CommandBus;

  beforeEach(() => {
    commandBus = new CommandBus(makeContainer());
  });

  it('returns Result.ok with handler return value on success', async () => {
    commandBus.register(TestCommand, new TestCommandHandler());
    const result = await commandBus.tryExecute<TestCommand, string>(new TestCommand('hello'));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('returns Result.fail when no handler is registered', async () => {
    const result = await commandBus.tryExecute(new TestCommand());

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('QueryBus.tryExecute', () => {
  let queryBus: QueryBus;

  beforeEach(() => {
    queryBus = new QueryBus(makeContainer());
  });

  it('returns Result.ok with handler return value on success', async () => {
    queryBus.register(TestQuery, new TestQueryHandler());
    const result = await queryBus.tryExecute<TestQuery, string>(new TestQuery('data'));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe('data');
  });

  it('returns Result.fail when no handler is registered', async () => {
    const result = await queryBus.tryExecute(new TestQuery());

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
  });
});
