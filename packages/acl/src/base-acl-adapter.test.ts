import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@vytches-ddd/utils';
import { BaseACLAdapter, SimpleACLAdapter } from './base-acl-adapter';
import { ACLError } from './acl-errors';
import type {
  IModelTranslator,
  IExternalAPI,
  ACLContextInfo,
  ExecuteOptions,
  ACLMiddleware,
} from './acl.interfaces';

// Test domain and external models
interface TestDomainModel {
  id: string;
  name: string;
  amount: number;
}

interface TestExternalModel {
  external_id: string;
  display_name: string;
  total_amount: string;
}

interface TestResult {
  success: boolean;
  message: string;
}

// Mock implementations
class MockTranslator implements IModelTranslator<TestDomainModel, TestExternalModel> {
  toExternal = vi.fn(
    (domain: TestDomainModel): TestExternalModel => ({
      external_id: domain.id,
      display_name: domain.name,
      total_amount: domain.amount.toString(),
    })
  );

  fromExternal = vi.fn(
    (external: TestExternalModel): TestDomainModel => ({
      id: external.external_id,
      name: external.display_name,
      amount: parseFloat(external.total_amount),
    })
  );
}

class MockExternalAPI implements IExternalAPI<TestExternalModel, TestResult> {
  execute = vi.fn(
    async (operation: string, model: TestExternalModel): Promise<TestResult> => ({
      success: true,
      message: `Executed ${operation} with ${model.external_id}`,
    })
  );

  fetch = vi.fn(
    async (identifier: string): Promise<TestExternalModel> => ({
      external_id: identifier,
      display_name: 'Test Item',
      total_amount: '100.00',
    })
  );

  healthCheck = vi.fn(async (): Promise<boolean> => true);
}

class TestACLAdapter extends BaseACLAdapter<TestDomainModel, TestExternalModel, TestResult> {
  constructor(
    contextInfo: ACLContextInfo,
    translator: IModelTranslator<TestDomainModel, TestExternalModel>,
    externalAPI: IExternalAPI<TestExternalModel, TestResult>
  ) {
    super(contextInfo, translator, externalAPI);
    this.registerSupportedOperations();
  }

  protected registerSupportedOperations(): void {
    this.registerOperation('CREATE');
    this.registerOperation('UPDATE');
    this.registerOperation('DELETE');
  }
}

describe('BaseACLAdapter', () => {
  let adapter: TestACLAdapter;
  let mockTranslator: MockTranslator;
  let mockExternalAPI: MockExternalAPI;
  let contextInfo: ACLContextInfo;

  beforeEach(() => {
    mockTranslator = new MockTranslator();
    mockExternalAPI = new MockExternalAPI();
    contextInfo = {
      contextName: 'TestContext',
      externalSystemName: 'TestSystem',
      version: '1.0.0',
      supportedOperations: ['CREATE', 'UPDATE', 'DELETE'],
    };

    adapter = new TestACLAdapter(contextInfo, mockTranslator, mockExternalAPI);
  });

  describe('construction and initialization', () => {
    it('should initialize with context info, translator, and external API', () => {
      expect(adapter.getContextInfo()).toEqual(contextInfo);
    });

    it('should register supported operations during construction', () => {
      expect(adapter.supportsOperation('CREATE')).toBe(true);
      expect(adapter.supportsOperation('UPDATE')).toBe(true);
      expect(adapter.supportsOperation('DELETE')).toBe(true);
      expect(adapter.supportsOperation('UNSUPPORTED')).toBe(false);
    });
  });

  describe('execute method', () => {
    const testDomainModel: TestDomainModel = {
      id: 'test-123',
      name: 'Test Item',
      amount: 100,
    };

    it('should execute supported operation successfully', async () => {
      const result = await adapter.execute('CREATE', testDomainModel);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        success: true,
        message: 'Executed CREATE with test-123',
      });
      expect(mockTranslator.toExternal).toHaveBeenCalledWith(testDomainModel);
      expect(mockExternalAPI.execute).toHaveBeenCalledWith('CREATE', {
        external_id: 'test-123',
        display_name: 'Test Item',
        total_amount: '100',
      });
    });

    it('should fail for unsupported operation', async () => {
      const result = await adapter.execute('UNSUPPORTED', testDomainModel);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain("Operation 'UNSUPPORTED' is not supported");
    });

    it('should handle external API errors', async () => {
      mockExternalAPI.execute.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await adapter.execute('CREATE', testDomainModel);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain("Operation 'CREATE' failed");
    });

    it('should handle translation errors', async () => {
      mockTranslator.toExternal.mockImplementationOnce(() => {
        throw new Error('Translation failed');
      });

      const result = await adapter.execute('CREATE', testDomainModel);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
    });

    it('should execute with timeout option', async () => {
      vi.useFakeTimers();

      mockExternalAPI.execute.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );

      const resultPromise = adapter.execute('CREATE', testDomainModel, { timeout: 1000 });

      vi.advanceTimersByTime(1000);

      const result = await resultPromise;

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('timeout');

      vi.useRealTimers();
    });

    it('should add correlation context to errors', async () => {
      mockExternalAPI.execute.mockRejectedValueOnce(new Error('Test error'));

      const options: ExecuteOptions = {
        correlationId: 'corr-123',
        metadata: { requestId: 'req-456' },
      };

      const result = await adapter.execute('CREATE', testDomainModel, options);

      expect(result.isFailure).toBe(true);
      const error = result.error;
      expect(error.metadata).toEqual({
        correlationId: 'corr-123',
        requestId: 'req-456',
      });
    });
  });

  describe('fetch method', () => {
    it('should fetch and translate external model successfully', async () => {
      const result = await adapter.fetch('test-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        id: 'test-123',
        name: 'Test Item',
        amount: 100,
      });
      expect(mockExternalAPI.fetch).toHaveBeenCalledWith('test-123');
      expect(mockTranslator.fromExternal).toHaveBeenCalledWith({
        external_id: 'test-123',
        display_name: 'Test Item',
        total_amount: '100.00',
      });
    });

    it('should handle fetch errors', async () => {
      mockExternalAPI.fetch.mockRejectedValueOnce(new Error('Not found'));

      const result = await adapter.fetch('not-found');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.operation).toBe('FETCH');
    });

    it('should handle translation errors during fetch', async () => {
      mockTranslator.fromExternal.mockImplementationOnce(() => {
        throw new Error('Translation failed');
      });

      const result = await adapter.fetch('test-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
    });
  });

  describe('middleware support', () => {
    it('should execute without middleware when none added', async () => {
      const testDomainModel: TestDomainModel = {
        id: 'test-123',
        name: 'Test Item',
        amount: 100,
      };

      const result = await adapter.execute('CREATE', testDomainModel);

      expect(result.isSuccess).toBe(true);
    });

    it('should execute middleware chain in correct order', async () => {
      const executionOrder: string[] = [];

      const middleware1: ACLMiddleware = {
        execute: vi.fn(async (operation, domainModel, options, next) => {
          executionOrder.push('middleware1-before');
          const result = await next();
          executionOrder.push('middleware1-after');
          return result;
        }),
      };

      const middleware2: ACLMiddleware = {
        execute: vi.fn(async (operation, domainModel, options, next) => {
          executionOrder.push('middleware2-before');
          const result = await next();
          executionOrder.push('middleware2-after');
          return result;
        }),
      };

      adapter.use(middleware1).use(middleware2);

      const testDomainModel: TestDomainModel = {
        id: 'test-123',
        name: 'Test Item',
        amount: 100,
      };

      await adapter.execute('CREATE', testDomainModel);

      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should allow middleware to short-circuit execution', async () => {
      const shortCircuitMiddleware: ACLMiddleware = {
        // @ts-expect-error adfs
        execute: vi.fn(async () => {
          return Result.fail(ACLError.unsupportedOperation('TestContext', 'BLOCKED'));
        }),
      };

      adapter.use(shortCircuitMiddleware);

      const testDomainModel: TestDomainModel = {
        id: 'test-123',
        name: 'Test Item',
        amount: 100,
      };

      const result = await adapter.execute('CREATE', testDomainModel);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('BLOCKED');
      expect(mockExternalAPI.execute).not.toHaveBeenCalled();
    });
  });

  describe('context info', () => {
    it('should return a copy of context info', () => {
      const returnedInfo = adapter.getContextInfo();

      expect(returnedInfo).toEqual(contextInfo);
      expect(returnedInfo).not.toBe(contextInfo); // Should be a copy
    });
  });
});

describe('SimpleACLAdapter', () => {
  let mockTranslator: MockTranslator;
  let mockExternalAPI: MockExternalAPI;

  beforeEach(() => {
    mockTranslator = new MockTranslator();
    mockExternalAPI = new MockExternalAPI();
  });

  describe('factory method', () => {
    it('should create adapter with provided operations', () => {
      const adapter = SimpleACLAdapter.create(
        'PaymentContext',
        'StripeAPI',
        mockTranslator,
        mockExternalAPI,
        ['CHARGE', 'REFUND']
      );

      expect(adapter.supportsOperation('CHARGE')).toBe(true);
      expect(adapter.supportsOperation('REFUND')).toBe(true);
      expect(adapter.supportsOperation('DELETE')).toBe(false);

      const contextInfo = adapter.getContextInfo();
      expect(contextInfo.contextName).toBe('PaymentContext');
      expect(contextInfo.externalSystemName).toBe('StripeAPI');
      expect(contextInfo.version).toBe('1.0.0');
      expect(contextInfo.supportedOperations).toEqual(['CHARGE', 'REFUND']);
    });
  });

  describe('operation registration', () => {
    it('should register only provided operations', () => {
      const adapter = new SimpleACLAdapter(
        {
          contextName: 'TestContext',
          externalSystemName: 'TestSystem',
          version: '1.0.0',
          supportedOperations: ['CREATE', 'READ'],
        },
        mockTranslator,
        mockExternalAPI,
        ['CREATE', 'READ']
      );

      expect(adapter.supportsOperation('CREATE')).toBe(true);
      expect(adapter.supportsOperation('READ')).toBe(true);
      expect(adapter.supportsOperation('UPDATE')).toBe(false);
      expect(adapter.supportsOperation('DELETE')).toBe(false);
    });
  });
});
