import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import 'reflect-metadata';
import { safeRun } from '@vytches/ddd-utils';
import type { IDependencyContainer } from '@vytches/ddd-di';
import { QueryBus, HandlerNotFoundError, CQRSConfigurationError } from '../../src';
import type { ICQRSMiddleware, IQuery, IQueryHandler, CQRSExecutionContext } from '../../src';

// Test query implementation
class TestQuery implements IQuery<string> {
  constructor(public readonly id: string) {}
}

// Test validatable query
class ValidatableQuery implements IQuery<string> {
  constructor(public readonly id: string) {}

  async validate(): Promise<void> {
    if (!this.id) {
      throw new Error('ID is required');
    }
  }
}

// Test query handler
class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    return `Result for ${query.id}`;
  }
}

// Shared execution order tracker
let globalExecutionOrder: number[] = [];

// Test middleware
class TestMiddleware implements ICQRSMiddleware {
  public executionOrder: number[] = [];

  constructor(private order: number) {}

  async handle(context: CQRSExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    this.executionOrder.push(this.order);
    globalExecutionOrder.push(this.order);
    const result = await next();
    // Copy the global execution order to this middleware
    this.executionOrder = [...globalExecutionOrder];
    return result;
  }
}

describe('QueryBus', () => {
  let queryBus: QueryBus;
  let mockContainer: IDependencyContainer;
  let mockHandler: TestQueryHandler;

  beforeEach(() => {
    // Reset global execution order
    globalExecutionOrder = [];

    mockContainer = {
      resolve: vi.fn(),
      register: vi.fn(),
      registerInstance: vi.fn(),
      registerFactory: vi.fn(),
      isRegistered: vi.fn(),
      dispose: vi.fn(),
      getServices: vi.fn(),
      createScope: vi.fn(),
      getServicesByTag: vi.fn(),
    };

    mockHandler = new TestQueryHandler();
    queryBus = new QueryBus(mockContainer);
  });

  describe('constructor', () => {
    it('should initialize with empty middlewares', () => {
      expect(queryBus).toBeInstanceOf(QueryBus);
    });

    it('should store container reference', () => {
      expect(queryBus['container']).toBe(mockContainer);
    });
  });

  describe('register', () => {
    it('should throw CQRSConfigurationError for manual registration', () => {
      const [registerError] = safeRun(() => {
        queryBus.register(TestQuery, mockHandler);
      });
      expect(registerError).toBeInstanceOf(CQRSConfigurationError);
    });

    it('should throw with deprecation message', () => {
      const [messageError] = safeRun(() => {
        queryBus.register(TestQuery, mockHandler);
      });
      expect(messageError?.message).toContain(
        'Manual registration is deprecated. Use @QueryHandler decorator and DI container instead.'
      );
    });
  });

  describe('registerFactory', () => {
    it('should throw CQRSConfigurationError for manual factory registration', () => {
      const factory = () => mockHandler;

      const [factoryError] = safeRun(() => {
        queryBus.registerFactory(TestQuery, factory);
      });
      expect(factoryError).toBeInstanceOf(CQRSConfigurationError);
    });

    it('should throw with deprecation message', () => {
      const factory = () => mockHandler;

      const [factoryMessageError] = safeRun(() => {
        queryBus.registerFactory(TestQuery, factory);
      });
      expect(factoryMessageError?.message).toContain(
        'Manual factory registration is deprecated. Use @QueryHandler decorator and DI container instead.'
      );
    });
  });

  describe('use', () => {
    it('should add middleware to the pipeline', () => {
      const middleware = new TestMiddleware(1);
      const result = queryBus.use(middleware);

      expect(result).toBe(queryBus);
      expect(queryBus['middlewares']).toHaveLength(1);
      expect(queryBus['middlewares'][0]).toBe(middleware);
    });

    it('should add multiple middlewares in order', () => {
      const middleware1 = new TestMiddleware(1);
      const middleware2 = new TestMiddleware(2);

      queryBus.use(middleware1).use(middleware2);

      expect(queryBus['middlewares']).toHaveLength(2);
      expect(queryBus['middlewares'][0]).toBe(middleware1);
      expect(queryBus['middlewares'][1]).toBe(middleware2);
    });

    it('should return this for chaining', () => {
      const middleware1 = new TestMiddleware(1);
      const middleware2 = new TestMiddleware(2);

      const result = queryBus.use(middleware1).use(middleware2);

      expect(result).toBe(queryBus);
    });
  });

  describe('discoverHandlers', () => {
    it('should log deprecation warning when not in CI', () => {
      const originalCI = process.env.CI;
      delete process.env.CI;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      queryBus.discoverHandlers();

      expect(consoleSpy).toHaveBeenCalledWith(
        'QueryBus.discoverHandlers() is deprecated. Handler discovery is now automatic through DI container.'
      );

      consoleSpy.mockRestore();
      process.env.CI = originalCI;
    });

    it('should not log deprecation warning in CI environment', () => {
      const originalCI = process.env.CI;
      process.env.CI = 'true';

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      queryBus.discoverHandlers();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.CI = originalCI;
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock Reflect.getMetadata
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });
    });

    it('should successfully execute a query and return result', async () => {
      const query = new TestQuery('test-id');
      const expectedResult = 'Result for test-id';
      const executeSpy = vi.spyOn(mockHandler, 'execute').mockResolvedValue(expectedResult);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const result = await queryBus.execute(query);

      expect(mockContainer.resolve).toHaveBeenCalledWith('testHandler');
      expect(executeSpy).toHaveBeenCalledWith(query);
      expect(result).toBe(expectedResult);
    });

    it('should throw HandlerNotFoundError when handler is not found', async () => {
      const query = new TestQuery('test-id');

      (mockContainer.resolve as Mock).mockImplementation(() => {
        throw new Error('Handler not found');
      });

      const [executeError] = await safeRun(() => queryBus.execute(query));
      expect(executeError).toBeInstanceOf(HandlerNotFoundError);
    });

    it('should throw CQRSConfigurationError when no handler metadata exists', async () => {
      const query = new TestQuery('test-id');

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

      const [executeError] = await safeRun(() => queryBus.execute(query));
      expect(executeError).toBeInstanceOf(CQRSConfigurationError);
      expect(executeError?.message).toContain(
        'No handler registered for query TestQuery. Did you forget @QueryHandler decorator?'
      );
    });

    it('should validate query when validatable', async () => {
      const query = new ValidatableQuery('test-id');
      const validateSpy = vi.spyOn(query, 'validate').mockResolvedValue(undefined);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await queryBus.execute(query);

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should throw validation error when validation fails', async () => {
      const query = new ValidatableQuery('');

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const [error] = await safeRun(() => queryBus.execute(query));
      expect(error?.message).toBe('ID is required');
    });

    it('should execute middleware in correct order', async () => {
      const query = new TestQuery('test-id');
      const middleware1 = new TestMiddleware(1);
      const middleware2 = new TestMiddleware(2);

      queryBus.use(middleware1).use(middleware2);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await queryBus.execute(query);

      expect(middleware1.executionOrder).toEqual([1, 2]);
    });

    it('should execute without middleware when none are registered', async () => {
      const query = new TestQuery('test-id');
      const expectedResult = 'Result for test-id';
      const executeSpy = vi.spyOn(mockHandler, 'execute').mockResolvedValue(expectedResult);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const result = await queryBus.execute(query);

      expect(executeSpy).toHaveBeenCalledWith(query);
      expect(result).toBe(expectedResult);
    });

    it('should handle handler execution errors', async () => {
      const query = new TestQuery('test-id');
      const handlerError = new Error('Handler execution failed');

      vi.spyOn(mockHandler, 'execute').mockRejectedValue(handlerError);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const [error] = await safeRun(() => queryBus.execute(query));
      expect(error?.message).toBe('Handler execution failed');
    });

    it('should create proper execution context', async () => {
      const query = new TestQuery('test-id');
      let capturedContext: CQRSExecutionContext;

      const middleware: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          capturedContext = context;
          return next();
        },
      };

      queryBus.use(middleware);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await queryBus.execute(query);

      expect(capturedContext!.commandOrQuery).toBe(query);
      expect(capturedContext!.handler).toBe(mockHandler);
      expect(capturedContext!.type).toBe('query');
    });

    it('should use service ID from metadata when available', async () => {
      const query = new TestQuery('test-id');

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'customServiceId',
        handlerType: TestQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await queryBus.execute(query);

      expect(mockContainer.resolve).toHaveBeenCalledWith('customServiceId');
    });

    it('should use handler type name when no service ID in metadata', async () => {
      const query = new TestQuery('test-id');

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        handlerType: TestQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await queryBus.execute(query);

      expect(mockContainer.resolve).toHaveBeenCalledWith('TestQueryHandler');
    });

    it('should return correct result type', async () => {
      const query = new TestQuery('test-id');
      const expectedResult = 'Custom result';

      vi.spyOn(mockHandler, 'execute').mockResolvedValue(expectedResult);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const result = await queryBus.execute(query);

      expect(result).toBe(expectedResult);
      expect(typeof result).toBe('string');
    });

    it('should handle different result types', async () => {
      class NumberQuery implements IQuery<number> {
        constructor(public readonly value: number) {}
      }

      class NumberQueryHandler implements IQueryHandler<NumberQuery, number> {
        async execute(query: NumberQuery): Promise<number> {
          return query.value * 2;
        }
      }

      const numberQuery = new NumberQuery(5);
      const numberHandler = new NumberQueryHandler();

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'numberHandler',
        handlerType: NumberQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(numberHandler);

      const result = await queryBus.execute(numberQuery);

      expect(result).toBe(10);
      expect(typeof result).toBe('number');
    });

    it('should handle complex object results', async () => {
      interface User {
        id: string;
        name: string;
      }

      class UserQuery implements IQuery<User> {
        constructor(public readonly id: string) {}
      }

      class UserQueryHandler implements IQueryHandler<UserQuery, User> {
        async execute(query: UserQuery): Promise<User> {
          return { id: query.id, name: `User ${query.id}` };
        }
      }

      const userQuery = new UserQuery('123');
      const userHandler = new UserQueryHandler();

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'userHandler',
        handlerType: UserQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(userHandler);

      const result = await queryBus.execute(userQuery);

      expect(result).toEqual({ id: '123', name: 'User 123' });
    });
  });

  describe('isValidatable', () => {
    it('should return true for objects with validate method', () => {
      const validatable = {
        validate: () => {
          return;
        },
      };
      expect(queryBus['isValidatable'](validatable)).toBe(true);
    });

    it('should return false for null', () => {
      expect(queryBus['isValidatable'](null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(queryBus['isValidatable'](undefined)).toBe(false);
    });

    it('should return false for objects without validate method', () => {
      const nonValidatable = { data: 'test' };
      expect(queryBus['isValidatable'](nonValidatable)).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(queryBus['isValidatable']('string')).toBe(false);
      expect(queryBus['isValidatable'](123)).toBe(false);
      expect(queryBus['isValidatable'](true)).toBe(false);
    });

    it('should return false when validate is not a function', () => {
      const invalidValidatable = { validate: 'not-a-function' };
      expect(queryBus['isValidatable'](invalidValidatable)).toBe(false);
    });
  });

  describe('middleware execution order', () => {
    it('should execute middleware in FIFO order', async () => {
      const query = new TestQuery('test-id');
      const executionOrder: number[] = [];

      const middleware1: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          executionOrder.push(1);
          const result = await next();
          executionOrder.push(4);
          return result;
        },
      };

      const middleware2: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          executionOrder.push(2);
          const result = await next();
          executionOrder.push(3);
          return result;
        },
      };

      queryBus.use(middleware1).use(middleware2);

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'testHandler',
        handlerType: TestQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await queryBus.execute(query);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should allow middleware to modify result', async () => {
      const query = new TestQuery('test-id');

      const transformMiddleware: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          const result = await next();
          return `Modified: ${result}`;
        },
      };

      queryBus.use(transformMiddleware);

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'testHandler',
        handlerType: TestQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const result = await queryBus.execute(query);

      expect(result).toBe('Modified: Result for test-id');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'testHandler',
        handlerType: TestQueryHandler,
      });
    });

    it('should propagate handler errors', async () => {
      const query = new TestQuery('test-id');
      const handlerError = new Error('Custom handler error');

      vi.spyOn(mockHandler, 'execute').mockRejectedValue(handlerError);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const [error] = await safeRun(() => queryBus.execute(query));
      expect(error?.message).toBe('Custom handler error');
    });

    it('should handle middleware errors', async () => {
      const query = new TestQuery('test-id');
      const middlewareError = new Error('Middleware error');

      const errorMiddleware: ICQRSMiddleware = {
        async handle(_context: CQRSExecutionContext, _next: () => Promise<unknown>) {
          throw middlewareError;
        },
      };

      queryBus.use(errorMiddleware);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const [error] = await safeRun(() => queryBus.execute(query));
      expect(error?.message).toBe('Middleware error');
    });
  });
});
