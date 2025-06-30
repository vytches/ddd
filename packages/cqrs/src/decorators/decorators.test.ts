import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommandHandler } from './command-handler.decorator';
import { QueryHandler } from './query-handler.decorator';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../interfaces';
import { CQRSMetadataRegistry } from '../registry';

describe('CQRS Decorators', () => {
  beforeEach(() => {
    CQRSMetadataRegistry.clearAll();
  });

  afterEach(() => {
    CQRSMetadataRegistry.clearAll();
  });

  describe('CommandHandler decorator', () => {
    class TestCommand implements ICommand {
      constructor(public readonly data: string) {}
    }

    class AnotherCommand implements ICommand {
      constructor(public readonly value: number) {}
    }

    it('should register command handler in metadata registry', () => {
      @CommandHandler(TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          // Implementation
        }
      }

      const commandHandlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(commandHandlers.has(TestCommand)).toBe(true);
      expect(commandHandlers.get(TestCommand)).toBe(TestCommandHandler);
    });

    it('should return the original class unchanged', () => {
      @CommandHandler(TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        public testProperty = 'test';
        
        async execute(_command: TestCommand): Promise<void> {
          // Implementation
        }

        public testMethod(): string {
          return 'test';
        }
      }

      // The decorator should not modify the class
      const instance = new TestCommandHandler();
      expect(instance.testProperty).toBe('test');
      expect(instance.testMethod()).toBe('test');
      expect(typeof instance.execute).toBe('function');
    });

    it('should register multiple command handlers', () => {
      @CommandHandler(TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      @CommandHandler(AnotherCommand)
      class AnotherCommandHandler implements ICommandHandler<AnotherCommand> {
        async execute(_command: AnotherCommand): Promise<void> {}
      }

      const commandHandlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(commandHandlers.size).toBe(2);
      expect(commandHandlers.get(TestCommand)).toBe(TestCommandHandler);
      expect(commandHandlers.get(AnotherCommand)).toBe(AnotherCommandHandler);
    });

    it('should allow multiple handlers for the same command (last one wins)', () => {
      @CommandHandler(TestCommand)
      class FirstHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      @CommandHandler(TestCommand)
      class SecondHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      const commandHandlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(commandHandlers.size).toBe(1);
      expect(commandHandlers.get(TestCommand)).toBe(SecondHandler);
    });

    it('should work with class inheritance', () => {
      class BaseHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      @CommandHandler(TestCommand)
      class ExtendedHandler extends BaseHandler {
        public extraMethod(): string {
          return 'extra';
        }
      }

      const commandHandlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(commandHandlers.get(TestCommand)).toBe(ExtendedHandler);

      const instance = new ExtendedHandler();
      expect(instance.extraMethod()).toBe('extra');
      expect(typeof instance.execute).toBe('function');
    });
  });

  describe('QueryHandler decorator', () => {
    class TestQuery implements IQuery<string> {
      constructor(public readonly id: string) {}
    }

    class AnotherQuery implements IQuery<number> {
      constructor(public readonly value: string) {}
    }

    it('should register query handler in metadata registry', () => {
      @QueryHandler(TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'result';
        }
      }

      const queryHandlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(queryHandlers.has(TestQuery)).toBe(true);
      expect(queryHandlers.get(TestQuery)).toBe(TestQueryHandler);
    });

    it('should return the original class unchanged', () => {
      @QueryHandler(TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        public testProperty = 'test';
        
        async execute(_query: TestQuery): Promise<string> {
          return 'result';
        }

        public testMethod(): string {
          return 'test';
        }
      }

      // The decorator should not modify the class
      const instance = new TestQueryHandler();
      expect(instance.testProperty).toBe('test');
      expect(instance.testMethod()).toBe('test');
      expect(typeof instance.execute).toBe('function');
    });

    it('should register multiple query handlers', () => {
      @QueryHandler(TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'test';
        }
      }

      @QueryHandler(AnotherQuery)
      class AnotherQueryHandler implements IQueryHandler<AnotherQuery, number> {
        async execute(_query: AnotherQuery): Promise<number> {
          return 42;
        }
      }

      const queryHandlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(queryHandlers.size).toBe(2);
      expect(queryHandlers.get(TestQuery)).toBe(TestQueryHandler);
      expect(queryHandlers.get(AnotherQuery)).toBe(AnotherQueryHandler);
    });

    it('should allow multiple handlers for the same query (last one wins)', () => {
      @QueryHandler(TestQuery)
      class FirstHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'first';
        }
      }

      @QueryHandler(TestQuery)
      class SecondHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'second';
        }
      }

      const queryHandlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(queryHandlers.size).toBe(1);
      expect(queryHandlers.get(TestQuery)).toBe(SecondHandler);
    });

    it('should work with different return types', () => {
      class StringQuery implements IQuery<string> {
        constructor(public readonly id: string) {}
      }

      class NumberQuery implements IQuery<number> {
        constructor(public readonly id: string) {}
      }

      class ObjectQuery implements IQuery<{ name: string; value: number }> {
        constructor(public readonly id: string) {}
      }

      @QueryHandler(StringQuery)
      class StringQueryHandler implements IQueryHandler<StringQuery, string> {
        async execute(_query: StringQuery): Promise<string> {
          return 'string';
        }
      }

      @QueryHandler(NumberQuery)
      class NumberQueryHandler implements IQueryHandler<NumberQuery, number> {
        async execute(_query: NumberQuery): Promise<number> {
          return 42;
        }
      }

      @QueryHandler(ObjectQuery)
      class ObjectQueryHandler implements IQueryHandler<ObjectQuery, { name: string; value: number }> {
        async execute(_query: ObjectQuery): Promise<{ name: string; value: number }> {
          return { name: 'test', value: 123 };
        }
      }

      const queryHandlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(queryHandlers.size).toBe(3);
      expect(queryHandlers.get(StringQuery)).toBe(StringQueryHandler);
      expect(queryHandlers.get(NumberQuery)).toBe(NumberQueryHandler);
      expect(queryHandlers.get(ObjectQuery)).toBe(ObjectQueryHandler);
    });
  });

  describe('Decorator integration', () => {
    it('should register both command and query handlers independently', () => {
      class TestCommand implements ICommand {
        constructor(public readonly data: string) {}
      }

      class TestQuery implements IQuery<string> {
        constructor(public readonly id: string) {}
      }

      @CommandHandler(TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      @QueryHandler(TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'result';
        }
      }

      const commandHandlers = CQRSMetadataRegistry.getCommandHandlers();
      const queryHandlers = CQRSMetadataRegistry.getQueryHandlers();

      expect(commandHandlers.size).toBe(1);
      expect(queryHandlers.size).toBe(1);
      expect(commandHandlers.get(TestCommand)).toBe(TestCommandHandler);
      expect(queryHandlers.get(TestQuery)).toBe(TestQueryHandler);
    });

    it('should work with complex command and query types', () => {
      interface UserData {
        name: string;
        email: string;
        age: number;
      }

      class CreateUserCommand implements ICommand {
        constructor(public readonly userData: UserData) {}
      }

      class GetUserQuery implements IQuery<UserData | null> {
        constructor(public readonly userId: string) {}
      }

      @CommandHandler(CreateUserCommand)
      class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
        async execute(_command: CreateUserCommand): Promise<void> {
          // Create user logic
        }
      }

      @QueryHandler(GetUserQuery)
      class GetUserHandler implements IQueryHandler<GetUserQuery, UserData | null> {
        async execute(_query: GetUserQuery): Promise<UserData | null> {
          return { name: 'John', email: 'john@example.com', age: 30 };
        }
      }

      const allHandlers = CQRSMetadataRegistry.getAllHandlers();
      expect(allHandlers.commands.get(CreateUserCommand)).toBe(CreateUserHandler);
      expect(allHandlers.queries.get(GetUserQuery)).toBe(GetUserHandler);
    });
  });
});