import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../../src';
import { QueryHandler, CommandHandler } from '../../src';

describe('CQRS Decorators', () => {
  // Test classes
  class TestCommand implements ICommand {
    constructor(public readonly data: string) {}
  }

  class AnotherCommand implements ICommand {
    constructor(public readonly value: number) {}
  }

  class TestQuery implements IQuery<string> {
    constructor(public readonly id: string) {}
  }

  class AnotherQuery implements IQuery<number> {
    constructor(public readonly count: number) {}
  }

  beforeEach(() => {
    // Clear any existing metadata
    Reflect.deleteMetadata('di:command-handler', TestCommand);
    Reflect.deleteMetadata('di:command-handler', AnotherCommand);
    Reflect.deleteMetadata('di:query-handler', TestQuery);
    Reflect.deleteMetadata('di:query-handler', AnotherQuery);
  });

  describe('CommandHandler decorator', () => {
    it('should register command handler metadata', () => {
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          // Implementation
        }
      }

      // Check metadata is stored in command class
      const commandMetadata = Reflect.getMetadata('di:command-handler', TestCommand);
      expect(commandMetadata).toBeDefined();
      expect(commandMetadata.handlerType).toBe(TestCommandHandler);
      expect(commandMetadata.serviceId).toBe('TestCommandHandler');

      // Check metadata is stored in handler class
      const handlerMetadata = Reflect.getMetadata('di:handler-metadata', TestCommandHandler);
      expect(handlerMetadata).toBeDefined();
      expect(handlerMetadata.type).toBe('command');
      expect(handlerMetadata.messageType).toBe(TestCommand);
    });

    it('should return the original class unchanged', () => {
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand)
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
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          return;
        }
      }

      @CommandHandler(AnotherCommand as new (...args: unknown[]) => AnotherCommand)
      class AnotherCommandHandler implements ICommandHandler<AnotherCommand> {
        async execute(_command: AnotherCommand): Promise<void> {
          return;
        }
      }

      const testMetadata = Reflect.getMetadata('di:command-handler', TestCommand);
      const anotherMetadata = Reflect.getMetadata('di:command-handler', AnotherCommand);

      expect(testMetadata).toBeDefined();
      expect(testMetadata.handlerType).toBe(TestCommandHandler);
      expect(anotherMetadata).toBeDefined();
      expect(anotherMetadata.handlerType).toBe(AnotherCommandHandler);
    });

    it('should allow custom service ID', () => {
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand, {
        serviceId: 'customTestHandler',
      })
      class _TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          // Implementation
        }
      }

      const metadata = Reflect.getMetadata('di:command-handler', TestCommand);
      expect(metadata.serviceId).toBe('customTestHandler');
    });

    it('should work with class inheritance', () => {
      abstract class BaseHandler<T extends ICommand> implements ICommandHandler<T> {
        abstract execute(command: T): Promise<void>;
      }

      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand)
      class TestCommandHandler extends BaseHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          return;
        }
      }

      const metadata = Reflect.getMetadata('di:command-handler', TestCommand);
      expect(metadata).toBeDefined();
      expect(metadata.handlerType).toBe(TestCommandHandler);
    });
  });

  describe('QueryHandler decorator', () => {
    it('should register query handler metadata', () => {
      @QueryHandler(TestQuery as new (...args: unknown[]) => TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'result';
        }
      }

      // Check metadata is stored in query class
      const queryMetadata = Reflect.getMetadata('di:query-handler', TestQuery);
      expect(queryMetadata).toBeDefined();
      expect(queryMetadata.handlerType).toBe(TestQueryHandler);
      expect(queryMetadata.serviceId).toBe('TestQueryHandler');

      // Check metadata is stored in handler class
      const handlerMetadata = Reflect.getMetadata('di:handler-metadata', TestQueryHandler);
      expect(handlerMetadata).toBeDefined();
      expect(handlerMetadata.type).toBe('query');
      expect(handlerMetadata.messageType).toBe(TestQuery);
    });

    it('should return the original class unchanged', () => {
      @QueryHandler(TestQuery as new (...args: unknown[]) => TestQuery)
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
      @QueryHandler(TestQuery as new (...args: unknown[]) => TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'test result';
        }
      }

      @QueryHandler(AnotherQuery as new (...args: unknown[]) => AnotherQuery)
      class AnotherQueryHandler implements IQueryHandler<AnotherQuery, number> {
        async execute(_query: AnotherQuery): Promise<number> {
          return 42;
        }
      }

      const testMetadata = Reflect.getMetadata('di:query-handler', TestQuery);
      const anotherMetadata = Reflect.getMetadata('di:query-handler', AnotherQuery);

      expect(testMetadata).toBeDefined();
      expect(testMetadata.handlerType).toBe(TestQueryHandler);
      expect(anotherMetadata).toBeDefined();
      expect(anotherMetadata.handlerType).toBe(AnotherQueryHandler);
    });

    it('should allow custom service ID', () => {
      @QueryHandler(TestQuery as new (...args: unknown[]) => TestQuery, {
        serviceId: 'customTestQueryHandler',
      })
      class _TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'result';
        }
      }

      const metadata = Reflect.getMetadata('di:query-handler', TestQuery);
      expect(metadata.serviceId).toBe('customTestQueryHandler');
    });

    it('should work with different return types', () => {
      @QueryHandler(TestQuery as new (...args: unknown[]) => TestQuery)
      class StringHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'string result';
        }
      }

      @QueryHandler(AnotherQuery as new (...args: unknown[]) => AnotherQuery)
      class NumberHandler implements IQueryHandler<AnotherQuery, number> {
        async execute(_query: AnotherQuery): Promise<number> {
          return 123;
        }
      }

      const stringMetadata = Reflect.getMetadata('di:query-handler', TestQuery);
      const numberMetadata = Reflect.getMetadata('di:query-handler', AnotherQuery);

      expect(stringMetadata.handlerType).toBe(StringHandler);
      expect(numberMetadata.handlerType).toBe(NumberHandler);
    });
  });

  describe('Decorator integration', () => {
    it('should register both command and query handlers independently', () => {
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          return;
        }
      }

      @QueryHandler(TestQuery as new (...args: unknown[]) => TestQuery)
      class TestQueryHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'result';
        }
      }

      const commandMetadata = Reflect.getMetadata('di:command-handler', TestCommand);
      const queryMetadata = Reflect.getMetadata('di:query-handler', TestQuery);

      expect(commandMetadata).toBeDefined();
      expect(commandMetadata.handlerType).toBe(TestCommandHandler);
      expect(queryMetadata).toBeDefined();
      expect(queryMetadata.handlerType).toBe(TestQueryHandler);
    });

    it('should work with complex command and query types', () => {
      interface ComplexData {
        id: string;
        items: Array<{ name: string; value: number }>;
      }

      class ComplexCommand implements ICommand {
        constructor(public readonly data: ComplexData) {}
      }

      class ComplexQuery implements IQuery<ComplexData> {
        constructor(public readonly filter: string) {}
      }

      @CommandHandler(ComplexCommand as new (...args: unknown[]) => ComplexCommand)
      class ComplexCommandHandler implements ICommandHandler<ComplexCommand> {
        async execute(_command: ComplexCommand): Promise<void> {
          return;
        }
      }

      @QueryHandler(ComplexQuery as new (...args: unknown[]) => ComplexQuery)
      class ComplexQueryHandler implements IQueryHandler<ComplexQuery, ComplexData> {
        async execute(_query: ComplexQuery): Promise<ComplexData> {
          return { id: 'test', items: [] };
        }
      }

      const commandMetadata = Reflect.getMetadata('di:command-handler', ComplexCommand);
      const queryMetadata = Reflect.getMetadata('di:query-handler', ComplexQuery);

      expect(commandMetadata.handlerType).toBe(ComplexCommandHandler);
      expect(queryMetadata.handlerType).toBe(ComplexQueryHandler);
    });
  });

  describe('Registration flags', () => {
    it('should mark handlers for DI registration by default', () => {
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand)
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          return;
        }
      }

      const isPending = Reflect.getMetadata('di:registration-pending', TestCommandHandler);
      expect(isPending).toBe(true);
    });

    it('should respect autoRegister false option', () => {
      @CommandHandler(TestCommand as new (...args: unknown[]) => TestCommand, {
        autoRegister: false,
      })
      class TestCommandHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {
          return;
        }
      }

      const isPending = Reflect.getMetadata('di:registration-pending', TestCommandHandler);
      expect(isPending).toBeUndefined();
    });
  });
});
