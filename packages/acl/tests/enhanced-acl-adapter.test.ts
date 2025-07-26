import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@vytches/ddd-utils';
import { EnhancedACLAdapter } from '../src/enhanced-acl-adapter';
import { ACLError } from '../src/acl-errors';
import type {
  IModelTranslator,
  IExternalAPI,
  ACLContextInfo,
  ExecuteOptions,
} from '../src/acl.interfaces';
import type { TypedOperation } from '../src/typed-operations';

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

// Typed operation test models
interface CreateOrderInput {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface CreateOrderOutput {
  orderId: string;
  status: 'pending' | 'confirmed';
  totalAmount: number;
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
    async (_operation: string, _model: TestExternalModel): Promise<TestResult> => ({
      success: true,
      message: 'Operation completed successfully',
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

class TestTypedOperation implements TypedOperation<CreateOrderInput, CreateOrderOutput> {
  readonly name = 'CREATE_ORDER';
  readonly description = 'Creates a new order';

  validateBusinessRules = vi.fn((input: CreateOrderInput): Result<void, Error> => {
    if (input.items.length === 0) {
      return Result.fail(new Error('Order must have at least one item'));
    }
    return Result.ok(undefined);
  });
}

class TestTypedOperationWithoutValidation
  implements TypedOperation<CreateOrderInput, CreateOrderOutput>
{
  readonly name = 'CREATE_ORDER_SIMPLE';
  readonly description = 'Creates a new order without validation';
  // No validateBusinessRules method
}

describe('EnhancedACLAdapter', () => {
  let adapter: EnhancedACLAdapter<TestDomainModel, TestExternalModel, TestResult>;
  let mockTranslator: MockTranslator;
  let mockExternalAPI: MockExternalAPI;
  let contextInfo: ACLContextInfo;

  beforeEach(() => {
    mockTranslator = new MockTranslator();
    mockExternalAPI = new MockExternalAPI();
    contextInfo = {
      contextName: 'OrderContext',
      externalSystemName: 'OrderAPI',
      version: '1.0.0',
      supportedOperations: ['CREATE_ORDER', 'CREATE_ORDER_SIMPLE', 'UPDATE_ORDER'],
    };

    adapter = new EnhancedACLAdapter(contextInfo, mockTranslator, mockExternalAPI, [
      'CREATE_ORDER',
      'CREATE_ORDER_SIMPLE',
      'UPDATE_ORDER',
    ]);
  });

  describe('construction', () => {
    it('should extend SimpleACLAdapter functionality', () => {
      expect(adapter.supportsOperation('CREATE_ORDER')).toBe(true);
      expect(adapter.supportsOperation('UPDATE_ORDER')).toBe(true);
      expect(adapter.supportsOperation('UNSUPPORTED')).toBe(false);
    });

    it('should maintain context info from parent class', () => {
      const retrievedContextInfo = adapter.getContextInfo();
      expect(retrievedContextInfo).toEqual(contextInfo);
    });
  });

  describe('executeTyped method', () => {
    const testDomainModel: TestDomainModel = {
      id: 'order-123',
      name: 'Test Order',
      amount: 150,
    };

    it('should execute typed operation successfully without validation', async () => {
      const operation = new TestTypedOperationWithoutValidation();

      // Mock the underlying execute to return a specific result
      mockExternalAPI.execute.mockResolvedValueOnce({
        success: true,
        message: 'Order created with ID order-123',
      });

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel
      );

      expect(result.isSuccess).toBe(true);
      expect(mockTranslator.toExternal).toHaveBeenCalledWith(testDomainModel);
      expect(mockExternalAPI.execute).toHaveBeenCalledWith('CREATE_ORDER_SIMPLE', {
        external_id: 'order-123',
        display_name: 'Test Order',
        total_amount: '150',
      });
    });

    it('should execute typed operation successfully with valid business rules', async () => {
      const operation = new TestTypedOperation();

      // Mock successful validation
      operation.validateBusinessRules.mockReturnValueOnce(Result.ok(undefined));

      // Mock the underlying execute to return a specific result
      mockExternalAPI.execute.mockResolvedValueOnce({
        success: true,
        message: 'Order created successfully',
      });

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel
      );

      expect(result.isSuccess).toBe(true);
      expect(operation.validateBusinessRules).toHaveBeenCalledWith(testDomainModel);
      expect(mockExternalAPI.execute).toHaveBeenCalled();
    });

    it('should fail when business rules validation fails', async () => {
      const operation = new TestTypedOperation();

      // Mock failed validation
      operation.validateBusinessRules.mockReturnValueOnce(
        Result.fail(new Error('Order must have at least one item'))
      );

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain('Business rule violation');
      expect(result.error.message).toContain('Order must have at least one item');
      expect(result.error.operation).toBe('CREATE_ORDER');
      expect(result.error.contextName).toBe('OrderContext');

      // Should not call external API when validation fails
      expect(mockExternalAPI.execute).not.toHaveBeenCalled();
    });

    it('should propagate underlying execution errors', async () => {
      const operation = new TestTypedOperationWithoutValidation();

      // Mock the underlying execute to fail
      mockExternalAPI.execute.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain("Operation 'CREATE_ORDER_SIMPLE' failed");
    });

    it('should execute with options passed through', async () => {
      const operation = new TestTypedOperationWithoutValidation();
      const options: ExecuteOptions = {
        timeout: 5000,
        correlationId: 'corr-456',
        metadata: { source: 'test' },
      };

      mockExternalAPI.execute.mockResolvedValueOnce({
        success: true,
        message: 'Success',
      });

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel,
        options
      );

      expect(result.isSuccess).toBe(true);
      expect(mockExternalAPI.execute).toHaveBeenCalled();
    });

    it('should handle type conversion correctly', async () => {
      const operation = new TestTypedOperationWithoutValidation();

      // Return a complex result that should be cast to TOutput
      const complexResult = {
        success: true,
        message: 'Complex operation result',
        data: { nestedProperty: 'value' },
      };

      mockExternalAPI.execute.mockResolvedValueOnce(complexResult);

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(complexResult);
    });
  });

  describe('middleware support', () => {
    it('should support middleware with typed operations', async () => {
      const operation = new TestTypedOperationWithoutValidation();
      let middlewareExecuted = false;

      const testDomainModel: TestDomainModel = {
        id: 'middleware-test',
        name: 'Middleware Test',
        amount: 200,
      };

      const testMiddleware = {
        execute: vi.fn(async (_operation, _domainModel, _options, next) => {
          middlewareExecuted = true;
          return await next();
        }),
      };

      adapter.use(testMiddleware);

      mockExternalAPI.execute.mockResolvedValueOnce({
        success: true,
        message: 'Success',
      });

      const result = await adapter.executeTyped<CreateOrderInput, CreateOrderOutput>(
        operation,
        testDomainModel
      );

      expect(result.isSuccess).toBe(true);
      expect(middlewareExecuted).toBe(true);
      expect(testMiddleware.execute).toHaveBeenCalled();
    });
  });

  describe('inheritance from SimpleACLAdapter', () => {
    it('should retain all parent functionality', async () => {
      const testDomainModel: TestDomainModel = {
        id: 'test-123',
        name: 'Test Item',
        amount: 100,
      };

      // Test regular execute method from parent
      const result = await adapter.execute('CREATE_ORDER', testDomainModel);

      expect(result.isSuccess).toBe(true);
      expect(mockTranslator.toExternal).toHaveBeenCalledWith(testDomainModel);
    });

    it('should retain fetch functionality from parent', async () => {
      const result = await adapter.fetch('test-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        id: 'test-123',
        name: 'Test Item',
        amount: 100,
      });
    });
  });
});

describe('EnhancedACLAdapter static factory', () => {
  let mockTranslator: MockTranslator;
  let mockExternalAPI: MockExternalAPI;

  beforeEach(() => {
    mockTranslator = new MockTranslator();
    mockExternalAPI = new MockExternalAPI();
  });

  describe('create method', () => {
    it('should create EnhancedACLAdapter with provided parameters', () => {
      const adapter = EnhancedACLAdapter.create(
        'PaymentContext',
        'StripeAPI',
        mockTranslator,
        mockExternalAPI,
        ['CHARGE', 'REFUND', 'CAPTURE']
      );

      expect(adapter).toBeInstanceOf(EnhancedACLAdapter);
      expect(adapter.supportsOperation('CHARGE')).toBe(true);
      expect(adapter.supportsOperation('REFUND')).toBe(true);
      expect(adapter.supportsOperation('CAPTURE')).toBe(true);
      expect(adapter.supportsOperation('UNKNOWN')).toBe(false);

      const contextInfo = adapter.getContextInfo();
      expect(contextInfo.contextName).toBe('PaymentContext');
      expect(contextInfo.externalSystemName).toBe('StripeAPI');
      expect(contextInfo.version).toBe('1.0.0');
      expect(contextInfo.supportedOperations).toEqual(['CHARGE', 'REFUND', 'CAPTURE']);
    });

    it('should create adapter with empty operations list', () => {
      const adapter = EnhancedACLAdapter.create(
        'TestContext',
        'TestSystem',
        mockTranslator,
        mockExternalAPI,
        []
      );

      expect(adapter).toBeInstanceOf(EnhancedACLAdapter);
      expect(adapter.supportsOperation('ANY_OPERATION')).toBe(false);

      const contextInfo = adapter.getContextInfo();
      expect(contextInfo.supportedOperations).toEqual([]);
    });
  });
});
