/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CQRSMetadataRegistry } from './metadata-registry';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../interfaces';

describe('CQRSMetadataRegistry', () => {
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
    constructor(public readonly filter: string) {}
  }

  class TestCommandHandler implements ICommandHandler<TestCommand> {
    async execute(_command: TestCommand): Promise<void> {}
  }

  class AnotherCommandHandler implements ICommandHandler<AnotherCommand> {
    async execute(_command: AnotherCommand): Promise<void> {}
  }

  class TestQueryHandler implements IQueryHandler<TestQuery, string> {
    async execute(_query: TestQuery): Promise<string> {
      return 'result';
    }
  }

  class AnotherQueryHandler implements IQueryHandler<AnotherQuery, number> {
    async execute(_query: AnotherQuery): Promise<number> {
      return 42;
    }
  }

  beforeEach(() => {
    CQRSMetadataRegistry.clearAll();
  });

  afterEach(() => {
    CQRSMetadataRegistry.clearAll();
  });

  describe('registerCommandHandler', () => {
    it('should register a command handler', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);

      const handlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(handlers.has(TestCommand)).toBe(true);
      expect(handlers.get(TestCommand)).toBe(TestCommandHandler);
    });

    it('should register multiple command handlers', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);
      CQRSMetadataRegistry.registerCommandHandler(AnotherCommand, AnotherCommandHandler);

      const handlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(handlers.size).toBe(2);
      expect(handlers.get(TestCommand)).toBe(TestCommandHandler);
      expect(handlers.get(AnotherCommand)).toBe(AnotherCommandHandler);
    });

    it('should overwrite existing command handler registration', () => {
      class FirstHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      class SecondHandler implements ICommandHandler<TestCommand> {
        async execute(_command: TestCommand): Promise<void> {}
      }

      CQRSMetadataRegistry.registerCommandHandler(TestCommand, FirstHandler);
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, SecondHandler);

      const handlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(handlers.size).toBe(1);
      expect(handlers.get(TestCommand)).toBe(SecondHandler);
    });
  });

  describe('registerQueryHandler', () => {
    it('should register a query handler', () => {
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);

      const handlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(handlers.has(TestQuery)).toBe(true);
      expect(handlers.get(TestQuery)).toBe(TestQueryHandler);
    });

    it('should register multiple query handlers', () => {
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);
      CQRSMetadataRegistry.registerQueryHandler(AnotherQuery, AnotherQueryHandler);

      const handlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(handlers.size).toBe(2);
      expect(handlers.get(TestQuery)).toBe(TestQueryHandler);
      expect(handlers.get(AnotherQuery)).toBe(AnotherQueryHandler);
    });

    it('should overwrite existing query handler registration', () => {
      class FirstHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'first';
        }
      }

      class SecondHandler implements IQueryHandler<TestQuery, string> {
        async execute(_query: TestQuery): Promise<string> {
          return 'second';
        }
      }

      CQRSMetadataRegistry.registerQueryHandler(TestQuery, FirstHandler);
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, SecondHandler);

      const handlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(handlers.size).toBe(1);
      expect(handlers.get(TestQuery)).toBe(SecondHandler);
    });
  });

  describe('getCommandHandlers', () => {
    it('should return empty map when no handlers registered', () => {
      const handlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(handlers).toBeInstanceOf(Map);
      expect(handlers.size).toBe(0);
    });

    it('should return copy of command handlers map', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);

      const handlers1 = CQRSMetadataRegistry.getCommandHandlers();
      const handlers2 = CQRSMetadataRegistry.getCommandHandlers();

      expect(handlers1).not.toBe(handlers2); // Different instances
      expect(handlers1.get(TestCommand)).toBe(handlers2.get(TestCommand)); // Same content
    });

    it('should not affect internal registry when modifying returned map', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);

      const handlers = CQRSMetadataRegistry.getCommandHandlers();
      handlers.clear(); // Modify the returned map

      // Internal registry should be unchanged
      const freshHandlers = CQRSMetadataRegistry.getCommandHandlers();
      expect(freshHandlers.size).toBe(1);
      expect(freshHandlers.get(TestCommand)).toBe(TestCommandHandler);
    });
  });

  describe('getQueryHandlers', () => {
    it('should return empty map when no handlers registered', () => {
      const handlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(handlers).toBeInstanceOf(Map);
      expect(handlers.size).toBe(0);
    });

    it('should return copy of query handlers map', () => {
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);

      const handlers1 = CQRSMetadataRegistry.getQueryHandlers();
      const handlers2 = CQRSMetadataRegistry.getQueryHandlers();

      expect(handlers1).not.toBe(handlers2); // Different instances
      expect(handlers1.get(TestQuery)).toBe(handlers2.get(TestQuery)); // Same content
    });

    it('should not affect internal registry when modifying returned map', () => {
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);

      const handlers = CQRSMetadataRegistry.getQueryHandlers();
      handlers.clear(); // Modify the returned map

      // Internal registry should be unchanged
      const freshHandlers = CQRSMetadataRegistry.getQueryHandlers();
      expect(freshHandlers.size).toBe(1);
      expect(freshHandlers.get(TestQuery)).toBe(TestQueryHandler);
    });
  });

  describe('getAllHandlers', () => {
    it('should return empty maps when no handlers registered', () => {
      const allHandlers = CQRSMetadataRegistry.getAllHandlers();

      expect(allHandlers.commands).toBeInstanceOf(Map);
      expect(allHandlers.queries).toBeInstanceOf(Map);
      expect(allHandlers.commands.size).toBe(0);
      expect(allHandlers.queries.size).toBe(0);
    });

    it('should return all registered handlers', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);
      CQRSMetadataRegistry.registerCommandHandler(AnotherCommand, AnotherCommandHandler);
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);
      CQRSMetadataRegistry.registerQueryHandler(AnotherQuery, AnotherQueryHandler);

      const allHandlers = CQRSMetadataRegistry.getAllHandlers();

      expect(allHandlers.commands.size).toBe(2);
      expect(allHandlers.queries.size).toBe(2);
      expect(allHandlers.commands.get(TestCommand)).toBe(TestCommandHandler);
      expect(allHandlers.commands.get(AnotherCommand)).toBe(AnotherCommandHandler);
      expect(allHandlers.queries.get(TestQuery)).toBe(TestQueryHandler);
      expect(allHandlers.queries.get(AnotherQuery)).toBe(AnotherQueryHandler);
    });

    it('should return copies of internal maps', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);

      const allHandlers1 = CQRSMetadataRegistry.getAllHandlers();
      const allHandlers2 = CQRSMetadataRegistry.getAllHandlers();

      expect(allHandlers1.commands).not.toBe(allHandlers2.commands);
      expect(allHandlers1.queries).not.toBe(allHandlers2.queries);
      expect(allHandlers1.commands.get(TestCommand)).toBe(allHandlers2.commands.get(TestCommand));
      expect(allHandlers1.queries.get(TestQuery)).toBe(allHandlers2.queries.get(TestQuery));
    });
  });

  describe('clearAll', () => {
    it('should clear all registered handlers', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);
      CQRSMetadataRegistry.registerCommandHandler(AnotherCommand, AnotherCommandHandler);
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);
      CQRSMetadataRegistry.registerQueryHandler(AnotherQuery, AnotherQueryHandler);

      // Verify handlers are registered
      expect(CQRSMetadataRegistry.getCommandHandlers().size).toBe(2);
      expect(CQRSMetadataRegistry.getQueryHandlers().size).toBe(2);

      CQRSMetadataRegistry.clearAll();

      // Verify all handlers are cleared
      expect(CQRSMetadataRegistry.getCommandHandlers().size).toBe(0);
      expect(CQRSMetadataRegistry.getQueryHandlers().size).toBe(0);
    });

    it('should not affect previously returned handler maps', () => {
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);

      const handlersBeforeClear = CQRSMetadataRegistry.getAllHandlers();

      CQRSMetadataRegistry.clearAll();

      // Previously returned maps should still contain handlers
      expect(handlersBeforeClear.commands.size).toBe(1);
      expect(handlersBeforeClear.queries.size).toBe(1);

      // New calls should return empty maps
      const handlersAfterClear = CQRSMetadataRegistry.getAllHandlers();
      expect(handlersAfterClear.commands.size).toBe(0);
      expect(handlersAfterClear.queries.size).toBe(0);
    });
  });

  describe('persistence across operations', () => {
    it('should maintain registration across multiple operations', () => {
      // Register handlers
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);
      CQRSMetadataRegistry.registerQueryHandler(TestQuery, TestQueryHandler);

      // Perform multiple get operations
      const commands1 = CQRSMetadataRegistry.getCommandHandlers();
      const queries1 = CQRSMetadataRegistry.getQueryHandlers();
      const all1 = CQRSMetadataRegistry.getAllHandlers();

      const commands2 = CQRSMetadataRegistry.getCommandHandlers();
      const queries2 = CQRSMetadataRegistry.getQueryHandlers();
      const all2 = CQRSMetadataRegistry.getAllHandlers();

      // All should contain the same registrations
      expect(commands1.get(TestCommand)).toBe(TestCommandHandler);
      expect(commands2.get(TestCommand)).toBe(TestCommandHandler);
      expect(queries1.get(TestQuery)).toBe(TestQueryHandler);
      expect(queries2.get(TestQuery)).toBe(TestQueryHandler);
      expect(all1.commands.get(TestCommand)).toBe(TestCommandHandler);
      expect(all2.commands.get(TestCommand)).toBe(TestCommandHandler);
      expect(all1.queries.get(TestQuery)).toBe(TestQueryHandler);
      expect(all2.queries.get(TestQuery)).toBe(TestQueryHandler);
    });
  });

  describe('static nature', () => {
    it('should maintain state across multiple registry references', () => {
      // Register using the class directly
      CQRSMetadataRegistry.registerCommandHandler(TestCommand, TestCommandHandler);

      // Create "another reference" (same static class)
      const AnotherReference = CQRSMetadataRegistry;

      // Should see the same registration
      const handlers = AnotherReference.getCommandHandlers();
      expect(handlers.get(TestCommand)).toBe(TestCommandHandler);

      // Register through "another reference"
      AnotherReference.registerQueryHandler(TestQuery, TestQueryHandler);

      // Original reference should see the new registration
      const queries = CQRSMetadataRegistry.getQueryHandlers();
      expect(queries.get(TestQuery)).toBe(TestQueryHandler);
    });
  });
});
