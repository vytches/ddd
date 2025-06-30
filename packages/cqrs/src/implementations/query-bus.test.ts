import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryBus } from './query-bus';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';
import { CQRSMetadataRegistry } from '../registry';

describe('QueryBus', () => {
  class TestQuery implements IQuery<string> {
    constructor(public readonly id: string) {}
  }

  class TestValidatableQuery implements IQuery<string> {
    constructor(public readonly id: string) {}

    async validate(): Promise<void> {
      if (this.id === 'invalid') {
        throw new Error('Validation failed');
      }
    }
  }

  class TestQueryHandler implements IQueryHandler<TestQuery, string> {
    async execute(_query: TestQuery): Promise<string> {
      return 'test-result';
    }
  }

  let queryBus: QueryBus;
  let mockHandler: IQueryHandler<TestQuery, string>;
  let mockMiddleware: ICQRSMiddleware;

  beforeEach(() => {
    queryBus = new QueryBus();
    mockHandler = {
      execute: vi.fn().mockResolvedValue('mocked-result'),
    };
    mockMiddleware = {
      handle: vi.fn().mockImplementation(async (context, next) => next()),
    };
  });

  describe('constructor', () => {
    it('should create query bus without handler resolver', () => {
      const bus = new QueryBus();
      expect(bus).toBeInstanceOf(QueryBus);
    });

    it('should create query bus with handler resolver', () => {
      const resolver = vi.fn();
      const bus = new QueryBus(resolver);
      expect(bus).toBeInstanceOf(QueryBus);
    });
  });

  describe('register', () => {
    it('should register query handler', () => {
      expect(() => {
        queryBus.register(TestQuery, mockHandler);
      }).not.toThrow();
    });
  });

  describe('registerFactory', () => {
    it('should register handler factory', () => {
      const factory = vi.fn().mockReturnValue(mockHandler);

      expect(() => {
        queryBus.registerFactory(TestQuery, factory);
      }).not.toThrow();
    });
  });

  describe('use', () => {
    it('should add middleware to pipeline', () => {
      const result = queryBus.use(mockMiddleware);
      expect(result).toBe(queryBus);
    });
  });

  describe('execute', () => {
    it('should execute query with registered handler', async () => {
      const query = new TestQuery('test-id');
      queryBus.register(TestQuery, mockHandler);

      const result = await queryBus.execute(query);

      expect(mockHandler.execute).toHaveBeenCalledWith(query);
      expect(result).toBe('mocked-result');
    });

    it('should execute query from factory', async () => {
      const query = new TestQuery('test-id');
      const factory = vi.fn().mockReturnValue(mockHandler);
      queryBus.registerFactory(TestQuery, factory);

      const result = await queryBus.execute(query);

      expect(factory).toHaveBeenCalled();
      expect(mockHandler.execute).toHaveBeenCalledWith(query);
      expect(result).toBe('mocked-result');
    });

    it('should throw error when handler not found', async () => {
      const query = new TestQuery('test-id');

      await expect(queryBus.execute(query)).rejects.toThrow(HandlerNotFoundError);
    });

    it('should validate query if validatable', async () => {
      const query = new TestValidatableQuery('valid-id');
      const validateSpy = vi.spyOn(query, 'validate');
      queryBus.register(TestValidatableQuery, mockHandler);

      await queryBus.execute(query);

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should throw validation error for invalid query', async () => {
      const query = new TestValidatableQuery('invalid');
      queryBus.register(TestValidatableQuery, mockHandler);

      await expect(queryBus.execute(query)).rejects.toThrow('Validation failed');
    });

    it('should execute with middleware pipeline', async () => {
      const query = new TestQuery('test-id');
      queryBus.register(TestQuery, mockHandler);
      queryBus.use(mockMiddleware);

      const result = await queryBus.execute(query);

      expect(mockMiddleware.handle).toHaveBeenCalled();
      expect(mockHandler.execute).toHaveBeenCalledWith(query);
      expect(result).toBe('mocked-result');
    });

    it('should execute multiple middlewares in order', async () => {
      const query = new TestQuery('test-id');
      const calls: number[] = [];

      const middleware1: ICQRSMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => {
          calls.push(1);
          return next();
        }),
      };

      const middleware2: ICQRSMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => {
          calls.push(2);
          return next();
        }),
      };

      queryBus.register(TestQuery, mockHandler);
      queryBus.use(middleware1);
      queryBus.use(middleware2);

      await queryBus.execute(query);

      expect(calls).toEqual([1, 2]);
    });

    it('should return result from handler', async () => {
      const query = new TestQuery('test-id');
      const expectedResult = 'expected-result';
      const handler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockResolvedValue(expectedResult),
      };

      queryBus.register(TestQuery, handler);

      const result = await queryBus.execute(query);

      expect(result).toBe(expectedResult);
    });
  });

  describe('discoverHandlers', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should throw error when no handler resolver provided', () => {
      const bus = new QueryBus();
      vi.spyOn(CQRSMetadataRegistry, 'getQueryHandlers').mockReturnValue(
        new Map([[TestQuery, TestQueryHandler]])
      );

      expect(() => bus.discoverHandlers()).toThrow(CQRSConfigurationError);
    });

    it('should auto-register handlers using resolver', () => {
      const resolver = vi.fn().mockReturnValue(mockHandler);
      const bus = new QueryBus(resolver);

      vi.spyOn(CQRSMetadataRegistry, 'getQueryHandlers').mockReturnValue(
        new Map([[TestQuery, TestQueryHandler]])
      );

      expect(() => bus.discoverHandlers()).not.toThrow();
      expect(resolver).toHaveBeenCalledWith(TestQueryHandler);
    });

    it('should skip already registered handlers', () => {
      const resolver = vi.fn().mockReturnValue(mockHandler);
      const bus = new QueryBus(resolver);

      // Pre-register handler
      bus.register(TestQuery, mockHandler);

      vi.spyOn(CQRSMetadataRegistry, 'getQueryHandlers').mockReturnValue(
        new Map([[TestQuery, TestQueryHandler]])
      );

      bus.discoverHandlers();

      expect(resolver).not.toHaveBeenCalled();
    });

    it('should throw configuration error when resolver fails', () => {
      const resolver = vi.fn().mockImplementation(() => {
        throw new Error('Resolution failed');
      });
      const bus = new QueryBus(resolver);

      vi.spyOn(CQRSMetadataRegistry, 'getQueryHandlers').mockReturnValue(
        new Map([[TestQuery, TestQueryHandler]])
      );

      expect(() => bus.discoverHandlers()).toThrow(CQRSConfigurationError);
    });
  });

  describe('middleware execution context', () => {
    it('should pass correct context to middleware', async () => {
      const query = new TestQuery('test-id');
      let capturedContext: CQRSExecutionContext | undefined;

      const contextCapturingMiddleware: ICQRSMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => {
          capturedContext = context;
          return next();
        }),
      };

      queryBus.register(TestQuery, mockHandler);
      queryBus.use(contextCapturingMiddleware);

      await queryBus.execute(query);

      expect(capturedContext).toBeInstanceOf(CQRSExecutionContext);
      expect(capturedContext?.commandOrQuery).toBe(query);
      expect(capturedContext?.handler).toBe(mockHandler);
      expect(capturedContext?.type).toBe('query');
    });
  });
});
