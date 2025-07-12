import { describe, it, expect, beforeEach } from 'vitest';
import { CQRSExecutionContext } from '../../src';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../../src';

describe('CQRSExecutionContext', () => {
  class TestCommand implements ICommand {
    constructor(public readonly data: string) {}
  }

  class TestQuery implements IQuery<string> {
    constructor(public readonly id: string) {}
  }

  const mockCommandHandler: ICommandHandler<TestCommand> = {
    execute: async (_command: TestCommand) => undefined,
  };

  const mockQueryHandler: IQueryHandler<TestQuery, string> = {
    execute: async (_query: TestQuery) => 'result',
  };

  describe('constructor', () => {
    it('should create context for command', () => {
      const command = new TestCommand('test');
      const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

      expect(context.commandOrQuery).toBe(command);
      expect(context.handler).toBe(mockCommandHandler);
      expect(context.type).toBe('command');
    });

    it('should create context for query', () => {
      const query = new TestQuery('test-id');
      const context = new CQRSExecutionContext(query, mockQueryHandler, 'query');

      expect(context.commandOrQuery).toBe(query);
      expect(context.handler).toBe(mockQueryHandler);
      expect(context.type).toBe('query');
    });

    it('should initialize empty metadata map', () => {
      const command = new TestCommand('test');
      const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

      expect(context.metadata).toBeInstanceOf(Map);
      expect(context.metadata.size).toBe(0);
    });
  });

  describe('metadata management', () => {
    let context: CQRSExecutionContext;

    beforeEach(() => {
      const command = new TestCommand('test');
      context = new CQRSExecutionContext(command, mockCommandHandler, 'command');
    });

    describe('setMetadata', () => {
      it('should set metadata value', () => {
        context.setMetadata('key1', 'value1');

        expect(context.metadata.get('key1')).toBe('value1');
      });

      it('should set multiple metadata values', () => {
        context.setMetadata('key1', 'value1');
        context.setMetadata('key2', 42);
        context.setMetadata('key3', { nested: true });

        expect(context.metadata.get('key1')).toBe('value1');
        expect(context.metadata.get('key2')).toBe(42);
        expect(context.metadata.get('key3')).toEqual({ nested: true });
      });

      it('should overwrite existing metadata', () => {
        context.setMetadata('key1', 'initial');
        context.setMetadata('key1', 'updated');

        expect(context.metadata.get('key1')).toBe('updated');
      });
    });

    describe('getMetadata', () => {
      it('should return metadata value if exists', () => {
        context.setMetadata('key1', 'value1');

        const result = context.getMetadata('key1');
        expect(result).toBe('value1');
      });

      it('should return undefined for non-existent key', () => {
        const result = context.getMetadata('nonexistent');
        expect(result).toBeUndefined();
      });

      it('should handle typed metadata retrieval', () => {
        const objectValue = { test: true, count: 42 };
        context.setMetadata('object', objectValue);

        const result = context.getMetadata<{ test: boolean; count: number }>('object');
        expect(result).toEqual(objectValue);
        expect(result?.test).toBe(true);
        expect(result?.count).toBe(42);
      });

      it('should handle different data types', () => {
        context.setMetadata('string', 'test');
        context.setMetadata('number', 123);
        context.setMetadata('boolean', true);
        context.setMetadata('array', [1, 2, 3]);
        context.setMetadata('object', { key: 'value' });

        expect(context.getMetadata<string>('string')).toBe('test');
        expect(context.getMetadata<number>('number')).toBe(123);
        expect(context.getMetadata<boolean>('boolean')).toBe(true);
        expect(context.getMetadata<number[]>('array')).toEqual([1, 2, 3]);
        expect(context.getMetadata<{ key: string }>('object')).toEqual({ key: 'value' });
      });
    });

    describe('metadata property', () => {
      it('should return the internal metadata map', () => {
        context.setMetadata('key1', 'value1');
        context.setMetadata('key2', 'value2');

        const metadata = context.metadata;
        expect(metadata).toBeInstanceOf(Map);
        expect(metadata.size).toBe(2);
        expect(metadata.get('key1')).toBe('value1');
        expect(metadata.get('key2')).toBe('value2');
      });

      it('should allow direct map operations', () => {
        const metadata = context.metadata;
        metadata.set('direct', 'value');

        expect(context.getMetadata('direct')).toBe('value');
      });
    });
  });

  describe('immutable properties', () => {
    it('should have readonly commandOrQuery property', () => {
      const command = new TestCommand('test');
      const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

      expect(context.commandOrQuery).toBe(command);
      // TypeScript should prevent modification: context.commandOrQuery = new TestCommand('other');
    });

    it('should have readonly handler property', () => {
      const command = new TestCommand('test');
      const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

      expect(context.handler).toBe(mockCommandHandler);
      // TypeScript should prevent modification: context.handler = otherHandler;
    });

    it('should have readonly type property', () => {
      const command = new TestCommand('test');
      const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

      expect(context.type).toBe('command');
      // TypeScript should prevent modification: context.type = 'query';
    });
  });

  describe('context for different scenarios', () => {
    it('should work with complex command objects', () => {
      class ComplexCommand implements ICommand {
        constructor(
          public readonly id: string,
          public readonly data: { name: string; values: number[] },
          public readonly metadata: { timestamp: Date; userId: string }
        ) {}
      }

      const complexCommand = new ComplexCommand(
        'cmd-123',
        { name: 'test', values: [1, 2, 3] },
        { timestamp: new Date(), userId: 'user-456' }
      );

      const context = new CQRSExecutionContext(complexCommand, mockCommandHandler, 'command');

      expect(context.commandOrQuery).toBe(complexCommand);
      expect(context.type).toBe('command');
    });

    it('should work with complex query objects', () => {
      class ComplexQuery implements IQuery<{ items: string[]; total: number }> {
        constructor(
          public readonly filters: { category: string; active: boolean },
          public readonly pagination: { page: number; size: number }
        ) {}
      }

      const complexQuery = new ComplexQuery(
        { category: 'electronics', active: true },
        { page: 1, size: 10 }
      );

      const complexQueryHandler: IQueryHandler<ComplexQuery, { items: string[]; total: number }> = {
        execute: async _query => ({ items: ['item1'], total: 1 }),
      };

      const context = new CQRSExecutionContext(complexQuery, complexQueryHandler, 'query');

      expect(context.commandOrQuery).toBe(complexQuery);
      expect(context.type).toBe('query');
    });
  });
});
