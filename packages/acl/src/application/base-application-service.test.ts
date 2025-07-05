import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@vytches-ddd/utils';
import {
  BaseApplicationService,
  ApplicationError,
  type IApplicationService,
} from './base-application-service';
import { BusinessRuleValidator } from '@vytches-ddd/validation';
import { ValidationError, ValidationErrors } from '@vytches-ddd/validation';

// Test request/response types
interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    country: string;
  };
}

interface UpdateOrderRequest {
  orderId: string;
  updates: {
    status?: 'pending' | 'confirmed' | 'shipped' | 'delivered';
    shippingAddress?: {
      street: string;
      city: string;
      country: string;
    };
  };
}

interface OrderResponse {
  orderId: string;
  status: string;
  total: number;
}

// Mock validator implementations
class MockCreateOrderValidator extends BusinessRuleValidator<CreateOrderRequest> {
  constructor() {
    super();
    // Override the validate method with mock implementation
    this.validate = vi.fn(
      (request: CreateOrderRequest): Result<CreateOrderRequest, ValidationErrors> => {
        const errors = [];

        if (!request.customerId) {
          errors.push(new ValidationError('customerId', 'Customer ID is required'));
        }

        if (!request.items || request.items.length === 0) {
          errors.push(new ValidationError('items', 'Order must have at least one item'));
        } else {
          request.items.forEach((item, index) => {
            if (item.quantity <= 0) {
              errors.push(
                new ValidationError(`items[${index}].quantity`, 'Quantity must be positive')
              );
            }
            if (item.price < 0) {
              errors.push(new ValidationError(`items[${index}].price`, 'Price cannot be negative'));
            }
          });
        }

        if (!request.shippingAddress.street) {
          errors.push(new ValidationError('shippingAddress.street', 'Street address is required'));
        }

        if (!request.shippingAddress.country) {
          errors.push(new ValidationError('shippingAddress.country', 'Country is required'));
        }

        if (errors.length > 0) {
          return Result.fail(new ValidationErrors(errors));
        }

        return Result.ok(request);
      }
    );
  }
}

class MockUpdateOrderValidator extends BusinessRuleValidator<UpdateOrderRequest> {
  constructor() {
    super();
    // Override the validate method with mock implementation
    this.validate = vi.fn(
      (request: UpdateOrderRequest): Result<UpdateOrderRequest, ValidationErrors> => {
        const errors = [];

        if (!request.orderId) {
          errors.push(new ValidationError('orderId', 'Order ID is required'));
        }

        if (!request.updates || Object.keys(request.updates).length === 0) {
          errors.push(new ValidationError('updates', 'At least one update field is required'));
        }

        if (
          request.updates.status &&
          !['pending', 'confirmed', 'shipped', 'delivered'].includes(request.updates.status)
        ) {
          errors.push(new ValidationError('updates.status', 'Invalid status value'));
        }

        if (errors.length > 0) {
          return Result.fail(new ValidationErrors(errors));
        }

        return Result.ok(request);
      }
    );
  }
}

// Concrete application service implementations for testing
class OrderApplicationService extends BaseApplicationService {
  constructor(
    private createOrderValidator: MockCreateOrderValidator,
    private updateOrderValidator: MockUpdateOrderValidator
  ) {
    super('OrderApplicationService');
  }

  async createOrder(
    request: CreateOrderRequest
  ): Promise<Result<OrderResponse, ApplicationError | Array<{ field: string; message: string }>>> {
    // Validate request
    const validationResult = this.validateRequest(request, this.createOrderValidator);
    if (validationResult.isFailure) {
      return Result.fail(validationResult.error);
    }

    try {
      // Simulate domain operation
      const total = request.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const response: OrderResponse = {
        orderId: `ORDER-${Date.now()}`,
        status: 'pending',
        total,
      };

      return Result.ok(response);
    } catch (error) {
      return Result.fail(this.handleDomainError(error));
    }
  }

  async updateOrder(
    request: UpdateOrderRequest
  ): Promise<Result<OrderResponse, ApplicationError | Array<{ field: string; message: string }>>> {
    const validationResult = this.validateRequest(request, this.updateOrderValidator);
    if (validationResult.isFailure) {
      return Result.fail(validationResult.error);
    }

    try {
      // Simulate domain operation that might throw
      if (request.orderId === 'THROW_ERROR') {
        throw new Error('Simulated domain error');
      }

      const response: OrderResponse = {
        orderId: request.orderId,
        status: request.updates.status || 'pending',
        total: 100, // Mock total
      };

      return Result.ok(response);
    } catch (error) {
      return Result.fail(this.handleDomainError(error));
    }
  }
}

class SimpleApplicationService extends BaseApplicationService {
  constructor() {
    super('SimpleApplicationService');
  }

  // Simple service with minimal functionality
  getServiceInfo(): string {
    return `Service: ${this.serviceName}`;
  }

  // Method that uses handleDomainError
  processWithError(): ApplicationError {
    const domainError = new Error('Domain operation failed');
    return this.handleDomainError(domainError);
  }
}

describe('BaseApplicationService', () => {
  describe('abstract class behavior', () => {
    it('should implement IApplicationService interface', () => {
      const service = new SimpleApplicationService();

      expect(service).toMatchObject({
        serviceName: expect.any(String),
      } as IApplicationService);
    });

    it('should require serviceName in constructor', () => {
      const service = new SimpleApplicationService();
      expect(service.serviceName).toBe('SimpleApplicationService');
    });

    it('should allow inheritance and extension', () => {
      const service = new SimpleApplicationService();

      expect(service).toBeInstanceOf(BaseApplicationService);
      expect(service.getServiceInfo()).toBe('Service: SimpleApplicationService');
    });
  });

  describe('validateRequest method', () => {
    let service: OrderApplicationService;
    let createValidator: MockCreateOrderValidator;
    let updateValidator: MockUpdateOrderValidator;

    beforeEach(() => {
      createValidator = new MockCreateOrderValidator();
      updateValidator = new MockUpdateOrderValidator();
      service = new OrderApplicationService(createValidator, updateValidator);
    });

    it('should validate valid request successfully', () => {
      const validRequest: CreateOrderRequest = {
        customerId: 'CUST-123',
        items: [
          { productId: 'PROD-1', quantity: 2, price: 10.5 },
          { productId: 'PROD-2', quantity: 1, price: 25.0 },
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'Springfield',
          country: 'USA',
        },
      };

      const result = (service as any).validateRequest(validRequest, createValidator);

      expect(result.isSuccess).toBe(true);
      expect(createValidator.validate).toHaveBeenCalledWith(validRequest);
    });

    it('should return validation errors for invalid request', () => {
      const invalidRequest: CreateOrderRequest = {
        customerId: '', // Invalid
        items: [], // Invalid
        shippingAddress: {
          street: '', // Invalid
          city: 'Springfield',
          country: '', // Invalid
        },
      };

      const result = (service as any).validateRequest(invalidRequest, createValidator);

      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual([
        { field: 'customerId', message: 'Customer ID is required' },
        { field: 'items', message: 'Order must have at least one item' },
        { field: 'shippingAddress.street', message: 'Street address is required' },
        { field: 'shippingAddress.country', message: 'Country is required' },
      ]);
    });

    it('should handle complex validation with nested errors', () => {
      const invalidRequest: CreateOrderRequest = {
        customerId: 'CUST-123',
        items: [
          { productId: 'PROD-1', quantity: -1, price: 10.5 }, // Invalid quantity
          { productId: 'PROD-2', quantity: 2, price: -5.0 }, // Invalid price
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'Springfield',
          country: 'USA',
        },
      };

      const result = (service as any).validateRequest(invalidRequest, createValidator);

      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual([
        { field: 'items[0].quantity', message: 'Quantity must be positive' },
        { field: 'items[1].price', message: 'Price cannot be negative' },
      ]);
    });

    it('should work with different validator types', () => {
      const updateRequest: UpdateOrderRequest = {
        orderId: 'ORDER-123',
        updates: {
          status: 'shipped',
        },
      };

      const result = (service as any).validateRequest(updateRequest, updateValidator);

      expect(result.isSuccess).toBe(true);
      expect(updateValidator.validate).toHaveBeenCalledWith(updateRequest);
    });
  });

  describe('handleDomainError method', () => {
    let service: SimpleApplicationService;

    beforeEach(() => {
      service = new SimpleApplicationService();
    });

    it('should wrap generic error in ApplicationError', () => {
      const originalError = new Error('Original domain error');

      const appError = (service as any).handleDomainError(originalError);

      expect(appError).toBeInstanceOf(ApplicationError);
      expect(appError.message).toBe('Domain operation failed: Original domain error');
      expect(appError.innerError).toBe(originalError);
    });

    it('should handle different error types', () => {
      const typeError = new TypeError('Type error');

      const appError = (service as any).handleDomainError(typeError);

      expect(appError).toBeInstanceOf(ApplicationError);
      expect(appError.message).toBe('Domain operation failed: Type error');
      expect(appError.innerError).toBe(typeError);
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error message';

      const appError = (service as any).handleDomainError(stringError);

      expect(appError).toBeInstanceOf(ApplicationError);
      expect(appError.message).toBe('Domain operation failed: String error message');
      expect(appError.innerError).toBe(stringError);
    });

    it('should handle null/undefined errors', () => {
      const nullError = null;

      const appError = (service as any).handleDomainError(nullError);

      expect(appError).toBeInstanceOf(ApplicationError);
      expect(appError.message).toBe('Domain operation failed: null');
      expect(appError.innerError).toBe(nullError);
    });

    it('should be accessible through public method', () => {
      const appError = service.processWithError();

      expect(appError).toBeInstanceOf(ApplicationError);
      expect(appError.message).toBe('Domain operation failed: Domain operation failed');
    });
  });
});

describe('ApplicationError', () => {
  describe('construction', () => {
    it('should create error with message only', () => {
      const error = new ApplicationError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.innerError).toBeUndefined();
    });

    it('should create error with message and inner error', () => {
      const innerError = new Error('Inner error');
      const error = new ApplicationError('Outer error message', innerError);

      expect(error.message).toBe('Outer error message');
      expect(error.innerError).toBe(innerError);
    });

    it('should extend IDomainError', () => {
      const error = new ApplicationError('Test error');

      expect(error).toBeInstanceOf(Error);
      // ApplicationError extends IDomainError which extends Error
      expect(error.name).toBe('IDomainError');
    });

    it('should include inner error in error data', () => {
      const innerError = new TypeError('Type mismatch');
      const error = new ApplicationError('Application error', innerError);

      // The error data should include the inner error
      expect((error as any).data.innerError).toBe(innerError);
    });
  });

  describe('error hierarchy', () => {
    it('should maintain proper error chain', () => {
      const rootCause = new Error('Root cause');
      const domainError = new Error('Domain error');
      const appError = new ApplicationError('Application layer error', domainError);

      expect(appError.message).toBe('Application layer error');
      expect(appError.innerError).toBe(domainError);
    });

    it('should work in try-catch blocks', () => {
      expect(() => {
        throw new ApplicationError('Test application error');
      }).toThrow('Test application error');
    });

    it('should be catchable as Error', () => {
      try {
        throw new ApplicationError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).message).toBe('Test error');
      }
    });
  });
});

describe('Integrated Application Service Scenarios', () => {
  let service: OrderApplicationService;
  let createValidator: MockCreateOrderValidator;
  let updateValidator: MockUpdateOrderValidator;

  beforeEach(() => {
    createValidator = new MockCreateOrderValidator();
    updateValidator = new MockUpdateOrderValidator();
    service = new OrderApplicationService(createValidator, updateValidator);
  });

  describe('createOrder workflow', () => {
    it('should successfully create order with valid request', async () => {
      const validRequest: CreateOrderRequest = {
        customerId: 'CUST-123',
        items: [
          { productId: 'PROD-1', quantity: 2, price: 15.5 },
          { productId: 'PROD-2', quantity: 1, price: 30.0 },
        ],
        shippingAddress: {
          street: '456 Oak Ave',
          city: 'Springfield',
          country: 'USA',
        },
      };

      const result = await service.createOrder(validRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toMatchObject({
        orderId: expect.stringMatching(/^ORDER-\d+$/),
        status: 'pending',
        total: 61.0, // (2 * 15.50) + (1 * 30.00)
      });
      expect(createValidator.validate).toHaveBeenCalledWith(validRequest);
    });

    it('should fail with validation errors for invalid request', async () => {
      const invalidRequest: CreateOrderRequest = {
        customerId: '',
        items: [],
        shippingAddress: {
          street: '',
          city: 'Springfield',
          country: '',
        },
      };

      const result = await service.createOrder(invalidRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual([
        { field: 'customerId', message: 'Customer ID is required' },
        { field: 'items', message: 'Order must have at least one item' },
        { field: 'shippingAddress.street', message: 'Street address is required' },
        { field: 'shippingAddress.country', message: 'Country is required' },
      ]);
    });

    it('should calculate total correctly for multiple items', async () => {
      const request: CreateOrderRequest = {
        customerId: 'CUST-456',
        items: [
          { productId: 'PROD-1', quantity: 3, price: 10.0 },
          { productId: 'PROD-2', quantity: 2, price: 25.5 },
          { productId: 'PROD-3', quantity: 1, price: 100.0 },
        ],
        shippingAddress: {
          street: '789 Pine St',
          city: 'Springfield',
          country: 'USA',
        },
      };

      const result = await service.createOrder(request);

      expect(result.isSuccess).toBe(true);
      expect(result.value.total).toBe(181.0); // (3*10) + (2*25.50) + (1*100)
    });
  });

  describe('updateOrder workflow', () => {
    it('should successfully update order with valid request', async () => {
      const validRequest: UpdateOrderRequest = {
        orderId: 'ORDER-123',
        updates: {
          status: 'shipped',
        },
      };

      const result = await service.updateOrder(validRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        orderId: 'ORDER-123',
        status: 'shipped',
        total: 100,
      });
      expect(updateValidator.validate).toHaveBeenCalledWith(validRequest);
    });

    it('should fail with validation errors for invalid request', async () => {
      const invalidRequest: UpdateOrderRequest = {
        orderId: '',
        updates: {},
      };

      const result = await service.updateOrder(invalidRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual([
        { field: 'orderId', message: 'Order ID is required' },
        { field: 'updates', message: 'At least one update field is required' },
      ]);
    });

    it('should handle domain errors and wrap them in ApplicationError', async () => {
      const errorRequest: UpdateOrderRequest = {
        orderId: 'THROW_ERROR', // This triggers a domain error
        updates: {
          status: 'confirmed',
        },
      };

      const result = await service.updateOrder(errorRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ApplicationError);
      expect((result.error as ApplicationError).message).toBe(
        'Domain operation failed: Simulated domain error'
      );
    });
  });

  describe('service identification', () => {
    it('should have correct service name', () => {
      expect(service.serviceName).toBe('OrderApplicationService');
    });

    it('should implement IApplicationService interface', () => {
      const serviceInterface: IApplicationService = service;
      expect(serviceInterface.serviceName).toBe('OrderApplicationService');
    });
  });

  describe('error handling patterns', () => {
    it('should distinguish between validation errors and application errors', async () => {
      // Validation error scenario
      const invalidRequest: CreateOrderRequest = {
        customerId: '',
        items: [],
        shippingAddress: { street: '', city: '', country: '' },
      };

      const validationResult = await service.createOrder(invalidRequest);
      expect(validationResult.isFailure).toBe(true);
      expect(Array.isArray(validationResult.error)).toBe(true); // ValidationErrors

      // Application error scenario
      const errorRequest: UpdateOrderRequest = {
        orderId: 'THROW_ERROR',
        updates: { status: 'confirmed' },
      };

      const applicationResult = await service.updateOrder(errorRequest);
      expect(applicationResult.isFailure).toBe(true);
      expect(applicationResult.error).toBeInstanceOf(ApplicationError);
    });
  });
});
