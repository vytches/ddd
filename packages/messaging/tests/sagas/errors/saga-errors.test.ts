import { describe, it, expect } from 'vitest';
import {
  SagaError,
  SagaExecutionError,
  SagaStepError,
  SagaConfigurationError,
  SagaEventProcessingError,
  SagaCompensationError,
  SagaDiscoveryError,
  SagaOrchestrationError,
  SagaInstanceLimitExceededError,
  SagaDefinitionNotFoundError,
} from '../../../src/sagas/errors';

describe('Saga Errors', () => {
  describe('SagaError (base class)', () => {
    class TestSagaError extends SagaError {
      constructor(
        message: string,
        sagaId: string,
        sagaType?: string,
        context?: Record<string, unknown>
      ) {
        super(message, sagaId, sagaType, context);
      }
    }

    it('should create error with basic properties', () => {
      const error = new TestSagaError('Test error', 'saga-123', 'TestSaga');

      expect(error.message).toBe('Test error');
      expect(error.sagaId).toBe('saga-123');
      expect(error.sagaType).toBe('TestSaga');
      expect(error.name).toBe('TestSagaError');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.errorId).toMatch(/^TestSagaError-\d+-[a-z0-9]+$/);
    });

    it('should include context in error', () => {
      const context = { stepName: 'processOrder', orderId: 'order-123' };
      const error = new TestSagaError('Test error', 'saga-123', 'TestSaga', context);

      expect(error.context).toMatchObject({
        sagaId: 'saga-123',
        sagaType: 'TestSaga',
        stepName: 'processOrder',
        orderId: 'order-123',
      });
    });

    it('should generate structured error data', () => {
      const error = new TestSagaError('Test error', 'saga-123', 'TestSaga');
      const structured = error.toStructured();

      expect(structured).toMatchObject({
        errorId: error.errorId,
        errorType: 'TestSagaError',
        message: 'Test error',
        sagaId: 'saga-123',
        sagaType: 'TestSaga',
        timestamp: expect.any(String),
        context: expect.any(Object),
      });
      expect(structured.stack).toBeDefined();
    });
  });

  describe('SagaExecutionError', () => {
    it('should create execution error with step and original error', () => {
      const originalError = new Error('Database connection failed');
      const error = new SagaExecutionError(
        'saga-123',
        'processPayment',
        originalError,
        'PaymentSaga'
      );

      expect(error.message).toBe(
        "Saga execution failed at step 'processPayment': Database connection failed"
      );
      expect(error.stepName).toBe('processPayment');
      expect(error.originalError).toBe(originalError);
      expect(error.sagaType).toBe('PaymentSaga');
    });

    it('should include original error details in context', () => {
      const originalError = new TypeError('Invalid payment data');
      const error = new SagaExecutionError(
        'saga-456',
        'validatePayment',
        originalError,
        'PaymentSaga',
        { paymentId: 'pay-123' }
      );

      expect(error.context).toMatchObject({
        stepName: 'validatePayment',
        originalErrorType: 'TypeError',
        originalErrorMessage: 'Invalid payment data',
        paymentId: 'pay-123',
      });
      expect(error.context.originalErrorStack).toBeDefined();
    });
  });

  describe('SagaStepError', () => {
    it('should create step error with custom message', () => {
      const error = new SagaStepError(
        'saga-789',
        'checkInventory',
        'Insufficient inventory for order',
        'OrderSaga'
      );

      expect(error.message).toBe('Insufficient inventory for order');
      expect(error.stepName).toBe('checkInventory');
      expect(error.sagaType).toBe('OrderSaga');
    });

    it('should include step data in error', () => {
      const stepData = { productId: 'prod-123', quantity: 10 };
      const error = new SagaStepError(
        'saga-789',
        'checkInventory',
        'Insufficient inventory',
        'OrderSaga',
        stepData
      );

      expect(error.stepData).toEqual(stepData);
      expect(error.context.stepData).toEqual(stepData);
    });
  });

  describe('SagaConfigurationError', () => {
    it('should create configuration error with validation errors', () => {
      const validationErrors = [
        'Missing required step: processPayment',
        'Invalid timeout value: -1000',
      ];
      const error = new SagaConfigurationError(
        'PaymentSaga',
        'Invalid saga configuration',
        validationErrors
      );

      expect(error.message).toBe(
        'Saga configuration error for PaymentSaga: Invalid saga configuration'
      );
      expect(error.sagaType).toBe('PaymentSaga');
      expect(error.validationErrors).toEqual(validationErrors);
    });

    it('should include configuration context', () => {
      const configContext = {
        steps: ['initiate', 'process'],
        timeout: -1000,
      };
      const error = new SagaConfigurationError(
        'TestSaga',
        'Invalid timeout',
        ['Timeout must be positive'],
        configContext
      );

      expect(error.configurationContext).toEqual(configContext);
    });

    it('should generate structured error data', () => {
      const error = new SagaConfigurationError('TestSaga', 'Configuration failed', [
        'Error 1',
        'Error 2',
      ]);
      const structured = error.toStructured();

      expect(structured).toMatchObject({
        errorType: 'SagaConfigurationError',
        sagaType: 'TestSaga',
        validationErrors: ['Error 1', 'Error 2'],
      });
    });
  });

  describe('SagaEventProcessingError', () => {
    it('should create event processing error', () => {
      const error = new SagaEventProcessingError(
        'saga-111',
        'OrderCreated',
        'Failed to parse event payload',
        'OrderSaga'
      );

      expect(error.message).toBe(
        'Event processing failed for OrderCreated: Failed to parse event payload'
      );
      expect(error.eventType).toBe('OrderCreated');
    });

    it('should include event data and processing context', () => {
      const eventData = { orderId: 'order-123', amount: 100 };
      const processingContext = { retryCount: 2, lastError: 'Timeout' };

      const error = new SagaEventProcessingError(
        'saga-222',
        'PaymentProcessed',
        'Processing failed',
        'PaymentSaga',
        eventData,
        processingContext
      );

      expect(error.eventData).toEqual(eventData);
      expect(error.processingContext).toEqual(processingContext);
      expect(error.context).toMatchObject({
        eventType: 'PaymentProcessed',
        eventData,
        processingContext,
      });
    });
  });

  describe('SagaCompensationError', () => {
    it('should create compensation error', () => {
      const originalError = new Error('Refund failed');
      const error = new SagaCompensationError(
        'saga-333',
        'processPayment',
        originalError,
        'PaymentSaga'
      );

      expect(error.message).toBe(
        "Saga compensation failed at step 'processPayment': Refund failed"
      );
      expect(error.stepName).toBe('processPayment');
      expect(error.originalError).toBe(originalError);
    });

    it('should include compensation data', () => {
      const compensationData = { refundAmount: 100, transactionId: 'tx-123' };
      const originalError = new Error('Refund service unavailable');

      const error = new SagaCompensationError(
        'saga-444',
        'chargePayment',
        originalError,
        'PaymentSaga',
        compensationData
      );

      expect(error.compensationData).toEqual(compensationData);
      expect(error.context.compensationData).toEqual(compensationData);
    });
  });

  describe('SagaDiscoveryError', () => {
    it('should create discovery error', () => {
      const error = new SagaDiscoveryError(
        'Failed to discover saga metadata',
        'OrderProcessingSaga'
      );

      expect(error.message).toBe('Failed to discover saga metadata');
      expect(error.className).toBe('OrderProcessingSaga');
      expect(error.name).toBe('SagaDiscoveryError');
    });

    it('should include discovery context', () => {
      const discoveryContext = {
        phase: 'metadata_extraction',
        availableDecorators: ['@Saga', '@SagaEventHandler'],
      };

      const error = new SagaDiscoveryError(
        'Missing required decorator',
        'TestSaga',
        discoveryContext
      );

      expect(error.discoveryContext).toEqual(discoveryContext);
    });

    it('should generate structured error data', () => {
      const error = new SagaDiscoveryError('Discovery failed', 'TestClass');
      const structured = error.toStructured();

      expect(structured).toMatchObject({
        errorType: 'SagaDiscoveryError',
        className: 'TestClass',
        message: 'Discovery failed',
      });
    });
  });

  describe('SagaOrchestrationError', () => {
    it('should create orchestration error', () => {
      const error = new SagaOrchestrationError(
        'saga-555',
        'Failed to coordinate saga execution',
        'MultiStepSaga',
        'processEvent'
      );

      expect(error.message).toBe('Failed to coordinate saga execution');
      expect(error.operation).toBe('processEvent');
      expect(error.sagaType).toBe('MultiStepSaga');
    });

    it('should include orchestration context', () => {
      const orchestrationContext = {
        activeSteps: ['step1', 'step2'],
        pendingEvents: 3,
      };

      const error = new SagaOrchestrationError(
        'saga-666',
        'Orchestration timeout',
        'ComplexSaga',
        'executeSteps',
        orchestrationContext
      );

      expect(error.orchestrationContext).toEqual(orchestrationContext);
      expect(error.context.orchestrationContext).toEqual(orchestrationContext);
    });
  });

  describe('SagaInstanceLimitExceededError', () => {
    it('should create instance limit error', () => {
      const error = new SagaInstanceLimitExceededError('OrderProcessingSaga', 10, 10);

      expect(error.message).toBe('Maximum instances reached for saga type: OrderProcessingSaga');
      expect(error.sagaType).toBe('OrderProcessingSaga');
      expect(error.maxInstances).toBe(10);
      expect(error.currentCount).toBe(10);
      expect(error.sagaId).toBe('N/A');
    });

    it('should include limit details in context', () => {
      const error = new SagaInstanceLimitExceededError('TestSaga', 5, 6);

      expect(error.context).toMatchObject({
        maxInstances: 5,
        currentCount: 6,
        sagaType: 'TestSaga',
      });
    });
  });

  describe('SagaDefinitionNotFoundError', () => {
    it('should create definition not found error', () => {
      const error = new SagaDefinitionNotFoundError('UnknownEvent', ['OrderSaga', 'PaymentSaga']);

      expect(error.message).toBe('No saga definition found for start event: UnknownEvent');
      expect(error.eventType).toBe('UnknownEvent');
      expect(error.availableDefinitions).toEqual(['OrderSaga', 'PaymentSaga']);
    });

    it('should handle empty available definitions', () => {
      const error = new SagaDefinitionNotFoundError('TestEvent');

      expect(error.availableDefinitions).toEqual([]);
    });

    it('should generate structured error data', () => {
      const error = new SagaDefinitionNotFoundError('TestEvent', ['Saga1', 'Saga2']);
      const structured = error.toStructured();

      expect(structured).toMatchObject({
        errorType: 'SagaDefinitionNotFoundError',
        eventType: 'TestEvent',
        availableDefinitions: ['Saga1', 'Saga2'],
      });
    });
  });

  describe('Error inheritance and instanceof checks', () => {
    it('should maintain proper inheritance chain', () => {
      const executionError = new SagaExecutionError(
        'saga-1',
        'step1',
        new Error('test'),
        'TestSaga'
      );

      expect(executionError).toBeInstanceOf(Error);
      expect(executionError).toBeInstanceOf(SagaError);
      expect(executionError).toBeInstanceOf(SagaExecutionError);
    });

    it('should work with configuration error inheritance', () => {
      const configError = new SagaConfigurationError('TestSaga', 'Invalid config');

      expect(configError).toBeInstanceOf(Error);
      expect(configError).toBeInstanceOf(SagaConfigurationError);
      // Note: SagaConfigurationError extends BaseError, not SagaError
    });
  });
});
