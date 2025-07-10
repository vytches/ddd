import type { MockedFunction } from 'vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CQRSExecutionContext, LoggingMiddleware } from '../../src';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../../src';

describe('LoggingMiddleware', () => {
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

  let mockLogger: { log: MockedFunction<(message: string) => void> };
  let middleware: LoggingMiddleware;
  let nextFunction: MockedFunction<() => Promise<any>>;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
    };
    nextFunction = vi.fn<[], Promise<any>>().mockResolvedValue('next-result');
  });

  describe('constructor', () => {
    it('should create middleware with custom logger', () => {
      const middleware = new LoggingMiddleware(mockLogger);
      expect(middleware).toBeInstanceOf(LoggingMiddleware);
    });

    it('should create middleware with default console logger', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const middleware = new LoggingMiddleware();

      expect(middleware).toBeInstanceOf(LoggingMiddleware);

      consoleSpy.mockRestore();
    });
  });

  describe('handle', () => {
    beforeEach(() => {
      middleware = new LoggingMiddleware(mockLogger);
    });

    describe('successful execution', () => {
      it('should log command execution start and completion', async () => {
        const command = new TestCommand('test-data');
        const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

        const result = await middleware.handle(context, nextFunction);

        expect(mockLogger.log).toHaveBeenCalledTimes(2);
        expect(mockLogger.log).toHaveBeenNthCalledWith(1, '[CQRS] Executing command: TestCommand');
        expect(mockLogger.log).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(/^\[CQRS\] command TestCommand completed in \d+ms$/)
        );
        expect(result).toBe('next-result');
        expect(nextFunction).toHaveBeenCalledOnce();
      });

      it('should log query execution start and completion', async () => {
        const query = new TestQuery('test-id');
        const context = new CQRSExecutionContext(query, mockQueryHandler, 'query');

        const result = await middleware.handle(context, nextFunction);

        expect(mockLogger.log).toHaveBeenCalledTimes(2);
        expect(mockLogger.log).toHaveBeenNthCalledWith(1, '[CQRS] Executing query: TestQuery');
        expect(mockLogger.log).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(/^\[CQRS\] query TestQuery completed in \d+ms$/)
        );
        expect(result).toBe('next-result');
      });

      it('should measure execution time accurately', async () => {
        const command = new TestCommand('test-data');
        const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

        const delay = 50;
        nextFunction.mockImplementation(
          async () =>
            new Promise<string>(resolve => setTimeout(() => resolve('delayed-result'), delay))
        );

        await middleware.handle(context, nextFunction);

        const completionLogCall = mockLogger?.log?.mock?.calls?.[1]?.[0];
        const durationMatch = completionLogCall?.match(/(\d+)ms$/);
        expect(durationMatch).toBeTruthy();

        const actualDuration = parseInt(durationMatch![1]!, 10);
        expect(actualDuration).toBeGreaterThanOrEqual(delay - 10); // Allow for timing variance
      });
    });

    describe('error handling', () => {
      it('should log command execution error and rethrow', async () => {
        const command = new TestCommand('test-data');
        const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');
        const error = new Error('Test error');

        nextFunction.mockRejectedValue(error);

        await expect(middleware.handle(context, nextFunction)).rejects.toThrow(error);

        expect(mockLogger.log).toHaveBeenCalledTimes(2);
        expect(mockLogger.log).toHaveBeenNthCalledWith(1, '[CQRS] Executing command: TestCommand');
        expect(mockLogger.log).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(
            /^\[CQRS\] command TestCommand failed after \d+ms: Error: Test error$/
          )
        );
      });

      it('should log query execution error and rethrow', async () => {
        const query = new TestQuery('test-id');
        const context = new CQRSExecutionContext(query, mockQueryHandler, 'query');
        const error = new Error('Query failed');

        nextFunction.mockRejectedValue(error);

        await expect(middleware.handle(context, nextFunction)).rejects.toThrow(error);

        expect(mockLogger.log).toHaveBeenCalledTimes(2);
        expect(mockLogger.log).toHaveBeenNthCalledWith(1, '[CQRS] Executing query: TestQuery');
        expect(mockLogger.log).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(
            /^\[CQRS\] query TestQuery failed after \d+ms: Error: Query failed$/
          )
        );
      });

      it('should measure execution time for failed operations', async () => {
        const command = new TestCommand('test-data');
        const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

        const delay = 30;
        nextFunction.mockImplementation(
          async () =>
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Delayed error')), delay)
            )
        );

        await expect(middleware.handle(context, nextFunction)).rejects.toThrow('Delayed error');

        const errorLogCall = mockLogger?.log?.mock?.calls?.[1]?.[0];
        const durationMatch = errorLogCall?.match(/failed after (\d+)ms:/);
        expect(durationMatch).toBeTruthy();

        const actualDuration = parseInt(durationMatch![1]!, 10);
        expect(actualDuration).toBeGreaterThanOrEqual(delay - 10); // Allow for timing variance
      });
    });

    describe('different command/query types', () => {
      it('should log different command types correctly', async () => {
        class CreateUserCommand implements ICommand {
          constructor(public readonly userData: { name: string; email: string }) {}
        }

        class DeleteOrderCommand implements ICommand {
          constructor(public readonly orderId: string) {}
        }

        const createCommand = new CreateUserCommand({ name: 'John', email: 'john@example.com' });
        const deleteCommand = new DeleteOrderCommand('order-123');

        const createContext = new CQRSExecutionContext(
          createCommand,
          mockCommandHandler,
          'command'
        );
        const deleteContext = new CQRSExecutionContext(
          deleteCommand,
          mockCommandHandler,
          'command'
        );

        await middleware.handle(createContext, nextFunction);
        await middleware.handle(deleteContext, nextFunction);

        expect(mockLogger.log).toHaveBeenCalledWith('[CQRS] Executing command: CreateUserCommand');
        expect(mockLogger.log).toHaveBeenCalledWith('[CQRS] Executing command: DeleteOrderCommand');
      });

      it('should log different query types correctly', async () => {
        class GetUserQuery implements IQuery<object> {
          constructor(public readonly userId: string) {}
        }

        class SearchProductsQuery implements IQuery<object[]> {
          constructor(public readonly filters: object) {}
        }

        const getUserQuery = new GetUserQuery('user-123');
        const searchQuery = new SearchProductsQuery({ category: 'electronics' });

        const getUserContext = new CQRSExecutionContext(getUserQuery, mockQueryHandler, 'query');
        const searchContext = new CQRSExecutionContext(searchQuery, mockQueryHandler, 'query');

        await middleware.handle(getUserContext, nextFunction);
        await middleware.handle(searchContext, nextFunction);

        expect(mockLogger.log).toHaveBeenCalledWith('[CQRS] Executing query: GetUserQuery');
        expect(mockLogger.log).toHaveBeenCalledWith('[CQRS] Executing query: SearchProductsQuery');
      });
    });

    describe('integration with console logger', () => {
      it('should work with default console logger', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const defaultMiddleware = new LoggingMiddleware();

        const command = new TestCommand('test-data');
        const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

        await defaultMiddleware.handle(context, nextFunction);

        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenNthCalledWith(1, '[CQRS] Executing command: TestCommand');
        expect(consoleSpy).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(/^\[CQRS\] command TestCommand completed in \d+ms$/)
        );

        consoleSpy.mockRestore();
      });
    });

    describe('async behavior', () => {
      it('should handle async operations correctly', async () => {
        const command = new TestCommand('test-data');
        const context = new CQRSExecutionContext(command, mockCommandHandler, 'command');

        nextFunction.mockImplementation(async () => {
          await new Promise<void>(resolve => setTimeout(resolve, 10));
          return 'async-result';
        });

        const result = await middleware.handle(context, nextFunction);

        expect(result).toBe('async-result');
        expect(mockLogger.log).toHaveBeenCalledTimes(2);
      });

      it('should handle multiple concurrent executions', async () => {
        const command1 = new TestCommand('test-1');
        const command2 = new TestCommand('test-2');
        const context1 = new CQRSExecutionContext(command1, mockCommandHandler, 'command');
        const context2 = new CQRSExecutionContext(command2, mockCommandHandler, 'command');

        const next1 = vi.fn<[], Promise<string>>().mockResolvedValue('result-1');
        const next2 = vi.fn<[], Promise<string>>().mockResolvedValue('result-2');

        const [result1, result2] = await Promise.all([
          middleware.handle(context1, next1),
          middleware.handle(context2, next2),
        ]);

        expect(result1).toBe('result-1');
        expect(result2).toBe('result-2');
        expect(mockLogger.log).toHaveBeenCalledTimes(4); // 2 start + 2 completion logs
      });
    });
  });
});
