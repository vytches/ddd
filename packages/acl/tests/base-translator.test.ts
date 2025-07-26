import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result, safeRun } from '@vytches/ddd-utils';
import { BaseModelTranslator } from '../src/base-translator';
import { TranslationError } from '../src/acl-errors';

// Test domain and external models
interface OrderDomainModel {
  orderId: string;
  customerName: string;
  totalAmount: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
}

interface OrderExternalModel {
  order_id: string;
  customer_name: string;
  total_amount: string;
  line_items: Array<{
    product_id: string;
    qty: number;
    unit_price: string;
  }>;
  created_timestamp: string;
}

// Concrete translator implementations for testing
class OrderTranslator extends BaseModelTranslator<OrderDomainModel, OrderExternalModel> {
  protected performToExternalTranslation(domainModel: OrderDomainModel): OrderExternalModel {
    return {
      order_id: domainModel.orderId,
      customer_name: domainModel.customerName,
      total_amount: domainModel.totalAmount.toFixed(2),
      line_items: domainModel.items.map(item => ({
        product_id: item.productId,
        qty: item.quantity,
        unit_price: item.price.toFixed(2),
      })),
      created_timestamp: domainModel.createdAt.toISOString(),
    };
  }

  protected performFromExternalTranslation(externalModel: OrderExternalModel): OrderDomainModel {
    return {
      orderId: externalModel.order_id,
      customerName: externalModel.customer_name,
      totalAmount: parseFloat(externalModel.total_amount),
      items: externalModel.line_items.map(item => ({
        productId: item.product_id,
        quantity: item.qty,
        price: parseFloat(item.unit_price),
      })),
      createdAt: new Date(externalModel.created_timestamp),
    };
  }
}

class ValidatingOrderTranslator extends BaseModelTranslator<OrderDomainModel, OrderExternalModel> {
  public override validateDomain = vi.fn((domainModel: OrderDomainModel): Result<void, Error> => {
    if (!domainModel.orderId) {
      return Result.fail(new Error('Order ID is required'));
    }
    if (domainModel.totalAmount <= 0) {
      return Result.fail(new Error('Total amount must be positive'));
    }
    if (domainModel.items.length === 0) {
      return Result.fail(new Error('Order must have at least one item'));
    }
    return Result.ok(undefined);
  });

  public override validateExternal = vi.fn(
    (externalModel: OrderExternalModel): Result<void, Error> => {
      if (!externalModel.order_id) {
        return Result.fail(new Error('External order_id is required'));
      }
      if (isNaN(parseFloat(externalModel.total_amount))) {
        return Result.fail(new Error('External total_amount must be a valid number'));
      }
      return Result.ok(undefined);
    }
  );

  protected performToExternalTranslation(domainModel: OrderDomainModel): OrderExternalModel {
    return {
      order_id: domainModel.orderId,
      customer_name: domainModel.customerName,
      total_amount: domainModel.totalAmount.toFixed(2),
      line_items: domainModel.items.map(item => ({
        product_id: item.productId,
        qty: item.quantity,
        unit_price: item.price.toFixed(2),
      })),
      created_timestamp: domainModel.createdAt.toISOString(),
    };
  }

  protected performFromExternalTranslation(externalModel: OrderExternalModel): OrderDomainModel {
    return {
      orderId: externalModel.order_id,
      customerName: externalModel.customer_name,
      totalAmount: parseFloat(externalModel.total_amount),
      items: externalModel.line_items.map(item => ({
        productId: item.product_id,
        quantity: item.qty,
        price: parseFloat(item.unit_price),
      })),
      createdAt: new Date(externalModel.created_timestamp),
    };
  }
}

class FailingTranslator extends BaseModelTranslator<OrderDomainModel, OrderExternalModel> {
  protected performToExternalTranslation(_domainModel: OrderDomainModel): OrderExternalModel {
    throw new Error('Conversion to external failed');
  }

  protected performFromExternalTranslation(_externalModel: OrderExternalModel): OrderDomainModel {
    throw new Error('Conversion from external failed');
  }
}

describe('BaseModelTranslator', () => {
  let translator: OrderTranslator;
  let validatingTranslator: ValidatingOrderTranslator;
  let sampleDomainModel: OrderDomainModel;
  let sampleExternalModel: OrderExternalModel;

  beforeEach(() => {
    translator = new OrderTranslator('OrderContext');
    validatingTranslator = new ValidatingOrderTranslator('ValidatingOrderContext');

    sampleDomainModel = {
      orderId: 'ORD-123',
      customerName: 'John Doe',
      totalAmount: 299.99,
      items: [
        {
          productId: 'PROD-456',
          quantity: 2,
          price: 149.99,
        },
      ],
      createdAt: new Date('2023-01-15T10:30:00Z'),
    };

    sampleExternalModel = {
      order_id: 'ORD-123',
      customer_name: 'John Doe',
      total_amount: '299.99',
      line_items: [
        {
          product_id: 'PROD-456',
          qty: 2,
          unit_price: '149.99',
        },
      ],
      created_timestamp: '2023-01-15T10:30:00.000Z',
    };
  });

  describe('construction', () => {
    it('should initialize with context name', () => {
      const contextName = 'TestOrderContext';
      const testTranslator = new OrderTranslator(contextName);

      expect((testTranslator as any).contextName).toBe(contextName);
    });

    it('should implement IModelTranslator interface', () => {
      expect(typeof translator.toExternal).toBe('function');
      expect(typeof translator.fromExternal).toBe('function');
    });
  });

  describe('toExternal method', () => {
    it('should successfully translate domain model to external model', () => {
      const result = translator.toExternal(sampleDomainModel);

      expect(result).toEqual(sampleExternalModel);
    });

    it('should handle complex domain models with multiple items', () => {
      const complexDomain: OrderDomainModel = {
        ...sampleDomainModel,
        items: [
          { productId: 'PROD-1', quantity: 1, price: 10.5 },
          { productId: 'PROD-2', quantity: 3, price: 25.75 },
          { productId: 'PROD-3', quantity: 2, price: 100.0 },
        ],
        totalAmount: 287.25,
      };

      const result = translator.toExternal(complexDomain);

      expect(result.line_items).toHaveLength(3);
      expect(result.line_items[0]).toEqual({
        product_id: 'PROD-1',
        qty: 1,
        unit_price: '10.50',
      });
      expect(result.line_items[2]).toEqual({
        product_id: 'PROD-3',
        qty: 2,
        unit_price: '100.00',
      });
      expect(result.total_amount).toBe('287.25');
    });

    it('should call domain validation when available', () => {
      validatingTranslator.toExternal(sampleDomainModel);

      expect(validatingTranslator.validateDomain).toHaveBeenCalledWith(sampleDomainModel);
    });

    it('should throw TranslationError when domain validation fails', () => {
      const invalidDomain = { ...sampleDomainModel, orderId: '' };

      const [error] = safeRun(() => validatingTranslator.toExternal(invalidDomain));
      expect(error).toBeInstanceOf(TranslationError);

      if (error instanceof TranslationError) {
        expect(error.direction).toBe('TO_EXTERNAL');
        expect(error.contextName).toBe('ValidatingOrderContext');
        expect(error.sourceModel).toBe(invalidDomain);
        expect(error.message).toContain('Domain validation failed');
      }
    });

    it('should throw TranslationError when translation implementation fails', () => {
      const failingTranslator = new FailingTranslator('FailingContext');

      const [error] = safeRun(() => failingTranslator.toExternal(sampleDomainModel));
      expect(error).toBeInstanceOf(TranslationError);

      if (error instanceof TranslationError) {
        expect(error.direction).toBe('TO_EXTERNAL');
        expect(error.contextName).toBe('FailingContext');
        expect(error.message).toContain('Conversion to external failed');
      }
    });

    it('should work without validation when validateDomain is not implemented', () => {
      const [error, result] = safeRun(() => translator.toExternal(sampleDomainModel));
      expect(error).toBeUndefined();
      expect(result).toEqual(sampleExternalModel);
    });
  });

  describe('fromExternal method', () => {
    it('should successfully translate external model to domain model', () => {
      const result = translator.fromExternal(sampleExternalModel);

      expect(result).toEqual(sampleDomainModel);
    });

    it('should handle complex external models with multiple line items', () => {
      const complexExternal: OrderExternalModel = {
        ...sampleExternalModel,
        line_items: [
          { product_id: 'PROD-A', qty: 5, unit_price: '12.99' },
          { product_id: 'PROD-B', qty: 1, unit_price: '49.99' },
        ],
        total_amount: '114.94',
      };

      const result = translator.fromExternal(complexExternal);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        productId: 'PROD-A',
        quantity: 5,
        price: 12.99,
      });
      expect(result.items[1]).toEqual({
        productId: 'PROD-B',
        quantity: 1,
        price: 49.99,
      });
      expect(result.totalAmount).toBe(114.94);
    });

    it('should call external validation when available', () => {
      validatingTranslator.fromExternal(sampleExternalModel);

      expect(validatingTranslator.validateExternal).toHaveBeenCalledWith(sampleExternalModel);
    });

    it('should throw TranslationError when external validation fails', () => {
      const invalidExternal = { ...sampleExternalModel, order_id: '' };

      const [error] = safeRun(() => validatingTranslator.fromExternal(invalidExternal));
      expect(error).toBeInstanceOf(TranslationError);

      if (error instanceof TranslationError) {
        expect(error.direction).toBe('FROM_EXTERNAL');
        expect(error.contextName).toBe('ValidatingOrderContext');
        expect(error.sourceModel).toBe(invalidExternal);
        expect(error.message).toContain('External validation failed');
      }
    });

    it('should throw TranslationError when translation implementation fails', () => {
      const failingTranslator = new FailingTranslator('FailingContext');

      const [error] = safeRun(() => failingTranslator.fromExternal(sampleExternalModel));
      expect(error).toBeInstanceOf(TranslationError);

      if (error instanceof TranslationError) {
        expect(error.direction).toBe('FROM_EXTERNAL');
        expect(error.contextName).toBe('FailingContext');
        expect(error.message).toContain('Conversion from external failed');
      }
    });

    it('should work without validation when validateExternal is not implemented', () => {
      const [error, result] = safeRun(() => translator.fromExternal(sampleExternalModel));
      expect(error).toBeUndefined();
      expect(result).toEqual(sampleDomainModel);
    });

    it('should properly parse date strings', () => {
      const externalWithDate = {
        ...sampleExternalModel,
        created_timestamp: '2023-12-25T15:45:30.123Z',
      };

      const result = translator.fromExternal(externalWithDate);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2023-12-25T15:45:30.123Z');
    });
  });

  describe('round-trip translations', () => {
    it('should maintain data integrity in domain -> external -> domain conversion', () => {
      const externalResult = translator.toExternal(sampleDomainModel);
      const domainResult = translator.fromExternal(externalResult);

      expect(domainResult).toEqual(sampleDomainModel);
    });

    it('should maintain data integrity in external -> domain -> external conversion', () => {
      const domainResult = translator.fromExternal(sampleExternalModel);
      const externalResult = translator.toExternal(domainResult);

      expect(externalResult).toEqual(sampleExternalModel);
    });

    it('should handle multiple round-trip conversions', () => {
      let current = sampleDomainModel;

      // Perform multiple round trips
      for (let i = 0; i < 3; i++) {
        const external = translator.toExternal(current);
        current = translator.fromExternal(external);
      }

      expect(current).toEqual(sampleDomainModel);
    });
  });

  describe('validation behavior', () => {
    it('should skip validation when validation methods are not implemented', () => {
      // OrderTranslator doesn't implement validation methods
      const [toExternalError] = safeRun(() => translator.toExternal(sampleDomainModel));
      const [fromExternalError] = safeRun(() => translator.fromExternal(sampleExternalModel));
      expect(toExternalError).toBeUndefined();
      expect(fromExternalError).toBeUndefined();
    });

    it('should call validation methods when they are implemented', () => {
      validatingTranslator.toExternal(sampleDomainModel);
      validatingTranslator.fromExternal(sampleExternalModel);

      expect(validatingTranslator.validateDomain).toHaveBeenCalledTimes(1);
      expect(validatingTranslator.validateExternal).toHaveBeenCalledTimes(1);
    });

    it('should handle validation success properly', () => {
      validatingTranslator.validateDomain.mockReturnValue(Result.ok(undefined));
      validatingTranslator.validateExternal.mockReturnValue(Result.ok(undefined));

      const [toExternalError] = safeRun(() => validatingTranslator.toExternal(sampleDomainModel));
      const [fromExternalError] = safeRun(() =>
        validatingTranslator.fromExternal(sampleExternalModel)
      );
      expect(toExternalError).toBeUndefined();
      expect(fromExternalError).toBeUndefined();
    });

    it('should provide detailed error information in validation failures', () => {
      const invalidDomain = { ...sampleDomainModel, totalAmount: -100 };

      try {
        validatingTranslator.toExternal(invalidDomain);
        expect.fail('Should have thrown TranslationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TranslationError);
        const translationError = error as TranslationError;
        expect(translationError.message).toContain('Domain validation failed');
        expect(translationError.message).toContain('Total amount must be positive');
        expect(translationError.sourceModel).toBe(invalidDomain);
        expect(translationError.direction).toBe('TO_EXTERNAL');
        expect(translationError.contextName).toBe('ValidatingOrderContext');
      }
    });
  });

  describe('error handling and context', () => {
    it('should preserve context name in translation errors', () => {
      const contextName = 'SpecialOrderContext';
      const contextTranslator = new FailingTranslator(contextName);

      try {
        contextTranslator.toExternal(sampleDomainModel);
        expect.fail('Should have thrown TranslationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TranslationError);
        expect((error as TranslationError).contextName).toBe(contextName);
      }
    });

    it('should wrap unexpected errors in TranslationError', () => {
      const translator = new (class extends BaseModelTranslator<
        OrderDomainModel,
        OrderExternalModel
      > {
        protected performToExternalTranslation(_domainModel: OrderDomainModel): OrderExternalModel {
          throw new TypeError('Unexpected type error');
        }

        protected performFromExternalTranslation(
          _externalModel: OrderExternalModel
        ): OrderDomainModel {
          throw new ReferenceError('Reference error');
        }
      })('ErrorContext');

      // Test toExternal error wrapping
      try {
        translator.toExternal(sampleDomainModel);
        expect.fail('Should have thrown TranslationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TranslationError);
        expect((error as TranslationError).message).toContain('Unexpected type error');
      }

      // Test fromExternal error wrapping
      try {
        translator.fromExternal(sampleExternalModel);
        expect.fail('Should have thrown TranslationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TranslationError);
        expect((error as TranslationError).message).toContain('Reference error');
      }
    });
  });

  describe('abstract methods', () => {
    it('should require implementation of performToExternalTranslation', () => {
      // This is verified through the concrete implementations
      expect(typeof translator['performToExternalTranslation']).toBe('function');
    });

    it('should require implementation of performFromExternalTranslation', () => {
      // This is verified through the concrete implementations
      expect(typeof translator['performFromExternalTranslation']).toBe('function');
    });

    it('should allow optional implementation of validation methods', () => {
      // Non-validating translator should work fine
      expect(translator.validateDomain).toBeUndefined();
      expect(translator.validateExternal).toBeUndefined();

      // Validating translator should have these methods
      expect(typeof validatingTranslator.validateDomain).toBe('function');
      expect(typeof validatingTranslator.validateExternal).toBe('function');
    });
  });
});
