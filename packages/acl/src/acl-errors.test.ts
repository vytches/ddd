import { describe, it, expect } from 'vitest';
import { ACLError, TranslationError } from './acl-errors';

describe('ACLError', () => {
  describe('constructor', () => {
    it('should create an ACLError with required parameters', () => {
      const error = new ACLError('Test error', 'TestContext');

      expect(error.message).toBe('Test error');
      expect(error.contextName).toBe('TestContext');
      expect(error.operation).toBeUndefined();
    });

    it('should create an ACLError with optional operation', () => {
      const error = new ACLError('Test error', 'TestContext', 'TEST_OP');

      expect(error.message).toBe('Test error');
      expect(error.contextName).toBe('TestContext');
      expect(error.operation).toBe('TEST_OP');
    });

    it('should create an ACLError with underlying error', () => {
      const underlyingError = new Error('Original error');
      const error = new ACLError('Test error', 'TestContext', 'TEST_OP', underlyingError);

      expect(error.message).toBe('Test error');
      expect(error.contextName).toBe('TestContext');
      expect(error.operation).toBe('TEST_OP');
    });

    it('should support metadata assignment', () => {
      const error = new ACLError('Test error', 'TestContext');
      error.metadata = { correlationId: '123', customData: 'test' };

      expect(error.metadata).toEqual({
        correlationId: '123',
        customData: 'test',
      });
    });
  });

  describe('static factory methods', () => {
    describe('translationFailed', () => {
      it('should create a translation error for TO_EXTERNAL direction', () => {
        const originalError = new Error('Transform failed');
        const error = ACLError.translationFailed('PaymentContext', 'TO_EXTERNAL', originalError);

        expect(error.message).toBe('Translation failed (TO_EXTERNAL): Transform failed');
        expect(error.contextName).toBe('PaymentContext');
        expect(error.operation).toBe('TRANSLATION');
      });

      it('should create a translation error for FROM_EXTERNAL direction', () => {
        const originalError = new Error('Parse failed');
        const error = ACLError.translationFailed('PaymentContext', 'FROM_EXTERNAL', originalError);

        expect(error.message).toBe('Translation failed (FROM_EXTERNAL): Parse failed');
        expect(error.contextName).toBe('PaymentContext');
        expect(error.operation).toBe('TRANSLATION');
      });
    });

    describe('operationFailed', () => {
      it('should create an operation failed error', () => {
        const originalError = new Error('Network timeout');
        const error = ACLError.operationFailed('PaymentContext', 'PROCESS_PAYMENT', originalError);

        expect(error.message).toBe("Operation 'PROCESS_PAYMENT' failed: Network timeout");
        expect(error.contextName).toBe('PaymentContext');
        expect(error.operation).toBe('PROCESS_PAYMENT');
      });
    });

    describe('unsupportedOperation', () => {
      it('should create an unsupported operation error', () => {
        const error = ACLError.unsupportedOperation('PaymentContext', 'UNSUPPORTED_OP');

        expect(error.message).toBe("Operation 'UNSUPPORTED_OP' is not supported");
        expect(error.contextName).toBe('PaymentContext');
        expect(error.operation).toBe('UNSUPPORTED_OP');
      });
    });

    describe('externalSystemUnavailable', () => {
      it('should create an external system unavailable error', () => {
        const error = ACLError.externalSystemUnavailable('PaymentContext', 'StripeAPI');

        expect(error.message).toBe("External system 'StripeAPI' is unavailable");
        expect(error.contextName).toBe('PaymentContext');
        expect(error.operation).toBe('HEALTH_CHECK');
      });
    });
  });
});

describe('TranslationError', () => {
  describe('constructor', () => {
    it('should create a TranslationError with all parameters', () => {
      const sourceModel = { id: 1, name: 'test' };
      const underlyingError = new Error('Validation failed');

      const error = new TranslationError(
        'Translation failed',
        'OrderContext',
        sourceModel,
        'TO_EXTERNAL',
        underlyingError
      );

      expect(error.message).toBe('Translation failed');
      expect(error.contextName).toBe('OrderContext');
      expect(error.operation).toBe('TRANSLATION');
      expect(error.sourceModel).toBe(sourceModel);
      expect(error.direction).toBe('TO_EXTERNAL');
    });
  });

  describe('static factory methods', () => {
    describe('forToExternal', () => {
      it('should create a TO_EXTERNAL translation error', () => {
        const sourceModel = { orderId: 'ORD-123', amount: 100 };
        const underlyingError = new Error('Invalid amount format');

        const error = TranslationError.forToExternal(
          'Failed to convert domain model to external format',
          'OrderContext',
          sourceModel,
          underlyingError
        );

        expect(error.message).toBe('Failed to convert domain model to external format');
        expect(error.contextName).toBe('OrderContext');
        expect(error.sourceModel).toBe(sourceModel);
        expect(error.direction).toBe('TO_EXTERNAL');
      });

      it('should create a TO_EXTERNAL translation error without underlying error', () => {
        const sourceModel = { orderId: 'ORD-123', amount: 100 };

        const error = TranslationError.forToExternal(
          'Failed to convert domain model',
          'OrderContext',
          sourceModel
        );

        expect(error.message).toBe('Failed to convert domain model');
        expect(error.contextName).toBe('OrderContext');
        expect(error.sourceModel).toBe(sourceModel);
        expect(error.direction).toBe('TO_EXTERNAL');
      });
    });

    describe('forFromExternal', () => {
      it('should create a FROM_EXTERNAL translation error', () => {
        const sourceModel = { order_id: 'ORD-123', total_amount: '100.00' };
        const underlyingError = new Error('Invalid date format');

        const error = TranslationError.forFromExternal(
          'Failed to convert external model to domain format',
          'OrderContext',
          sourceModel,
          underlyingError
        );

        expect(error.message).toBe('Failed to convert external model to domain format');
        expect(error.contextName).toBe('OrderContext');
        expect(error.sourceModel).toBe(sourceModel);
        expect(error.direction).toBe('FROM_EXTERNAL');
      });

      it('should create a FROM_EXTERNAL translation error without underlying error', () => {
        const sourceModel = { order_id: 'ORD-123', total_amount: '100.00' };

        const error = TranslationError.forFromExternal(
          'Failed to convert external model',
          'OrderContext',
          sourceModel
        );

        expect(error.message).toBe('Failed to convert external model');
        expect(error.contextName).toBe('OrderContext');
        expect(error.sourceModel).toBe(sourceModel);
        expect(error.direction).toBe('FROM_EXTERNAL');
      });
    });
  });

  describe('inheritance', () => {
    it('should be instance of ACLError', () => {
      const error = TranslationError.forToExternal('Test', 'TestContext', {});

      expect(error).toBeInstanceOf(TranslationError);
      expect(error).toBeInstanceOf(ACLError);
    });

    it('should support metadata from parent class', () => {
      const error = TranslationError.forToExternal('Test', 'TestContext', {});
      error.metadata = { requestId: 'req-123' };

      expect(error.metadata).toEqual({ requestId: 'req-123' });
    });
  });
});
