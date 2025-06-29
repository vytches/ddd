import { describe, it, expect } from 'vitest';
import type { IValidator, IValidationErrors } from '@vytches-ddd/contracts';
import { Result } from '@vytches-ddd/utils';
import { BaseValidationAdapter, AdapterUtils } from './base-adapter';
import { ValidationError, ValidationErrors } from '../validation-error';
import { Validation } from '../validation-facade';

// Mock implementations representing different validation libraries
class MockZodAdapter<T> extends BaseValidationAdapter<T, any> {
  validate(value: T): Result<T, IValidationErrors> {
    const errors: ValidationError[] = [];

    // Simulate Zod-like validation
    if (typeof value === 'object' && value !== null) {
      const obj = value as any;

      if (!obj.id || typeof obj.id !== 'string') {
        errors.push(this.createValidationError('id', 'ID must be a string'));
      }

      if (!obj.email || !obj.email.includes('@')) {
        errors.push(this.createValidationError('email', 'Invalid email format'));
      }

      if (typeof obj.age !== 'number' || obj.age < 0) {
        errors.push(this.createValidationError('age', 'Age must be a positive number'));
      }
    }

    if (errors.length > 0) {
      return this.failWithErrors(errors);
    }

    return this.success(value);
  }

  static create<T>(schema: any): MockZodAdapter<T> {
    return new MockZodAdapter(schema);
  }
}

class MockJoiAdapter<T> extends BaseValidationAdapter<T, any> {
  validate(value: T): Result<T, IValidationErrors> {
    const errors: ValidationError[] = [];

    // Simulate Joi-like validation
    if (typeof value === 'object' && value !== null) {
      const obj = value as any;

      if (!obj.name || obj.name.length < 2) {
        errors.push(
          this.createValidationError('name', 'Name must be at least 2 characters', {
            joiType: 'string.min',
          })
        );
      }

      if (obj.status && !['active', 'inactive', 'pending'].includes(obj.status)) {
        errors.push(
          this.createValidationError('status', 'Status must be one of: active, inactive, pending', {
            joiType: 'any.only',
          })
        );
      }
    }

    if (errors.length > 0) {
      return this.failWithErrors(errors);
    }

    return this.success(value);
  }

  static create<T>(schema: any): MockJoiAdapter<T> {
    return new MockJoiAdapter(schema);
  }
}

// Mock external API validator
class ExternalApiValidator<T> implements IValidator<T> {
  constructor(private shouldFail = false) {}

  validate(value: T): Result<T, IValidationErrors> {
    if (this.shouldFail) {
      return Result.fail(
        new ValidationErrors([
          new ValidationError('external', 'External API validation failed', { source: 'api' }),
        ])
      );
    }
    return Result.ok(value);
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive' | 'pending';
  subscription?: 'basic' | 'premium';
  profile?: UserProfile;
}

interface UserProfile {
  bio: string;
  website?: string;
}

describe('Adapter Integration Tests', () => {
  const validUser: User = {
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
    age: 25,
    status: 'active',
    subscription: 'premium',
  };

  const invalidUser: User = {
    id: '',
    name: 'J',
    email: 'invalid-email',
    age: -5,
    status: 'unknown' as any,
    subscription: 'premium',
  };

  describe('Single Adapter Usage', () => {
    it('should validate with Zod-like adapter', () => {
      // Arrange
      const zodAdapter = MockZodAdapter.create({});

      // Act
      const validResult = zodAdapter.validate(validUser);
      const invalidResult = zodAdapter.validate(invalidUser);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error.errors).toHaveLength(3); // id, email, age
    });

    it('should validate with Joi-like adapter', () => {
      // Arrange
      const joiAdapter = MockJoiAdapter.create({});

      // Act
      const validResult = joiAdapter.validate(validUser);
      const invalidResult = joiAdapter.validate(invalidUser);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error.errors).toHaveLength(2); // name, status
    });
  });

  describe('Adapter Composition with Validation.combine', () => {
    it('should combine multiple adapters successfully', () => {
      // Arrange
      const zodAdapter = MockZodAdapter.create({});
      const joiAdapter = MockJoiAdapter.create({});
      const businessRules = Validation.create<User>()
        .addRule(
          'subscription',
          user => user.subscription !== undefined,
          'Subscription is required'
        )
        .when(
          user => user.subscription === 'premium',
          v => v.addRule('age', user => user.age >= 21, 'Premium users must be 21+')
        );

      // Act
      const combinedValidator = Validation.combine(zodAdapter, joiAdapter, businessRules);

      const validResult = combinedValidator.validate(validUser);
      const invalidResult = combinedValidator.validate(invalidUser);

      // Assert
      expect(validResult.isSuccess).toBe(true);

      expect(invalidResult.isFailure).toBe(true);
      // Should have errors from all validators
      const errorMessages = invalidResult.error.errors.map(e => e.message);
      expect(errorMessages).toContain('ID must be a string'); // Zod
      expect(errorMessages).toContain('Name must be at least 2 characters'); // Joi
      expect(errorMessages).toContain('Premium users must be 21+'); // Business rule
    });

    it('should handle layered validation (format -> business -> domain)', () => {
      // Arrange
      const formatValidator = MockZodAdapter.create({}); // Format validation

      const businessValidator = Validation.create<User>() // Business rules
        .addRule('status', user => user.status === 'active', 'User must be active')
        .addRule('subscription', user => !!user.subscription, 'Subscription required');

      const domainValidator = AdapterUtils.create<User>(user => {
        // Domain rules
        const errors: string[] = [];
        if (user.age < 18) errors.push('Must be adult');
        if (!user.email.endsWith('.com')) errors.push('Must use .com email');

        return {
          success: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
        };
      }, 'domain');

      // Act
      const layeredValidator = Validation.combine(
        formatValidator,
        businessValidator,
        domainValidator
      );

      const testUser = {
        ...validUser,
        status: 'inactive' as const,
        email: 'john@example.org',
        age: 17,
      };

      const result = layeredValidator.validate(testUser);

      // Assert
      expect(result.isFailure).toBe(true);
      const errorMessages = result.error.errors.map(e => e.message);
      expect(errorMessages).toContain('User must be active'); // Business
      expect(errorMessages).toContain('Must use .com email'); // Domain
    });

    it('should combine with external API validation', () => {
      // Arrange
      const formatValidator = MockZodAdapter.create({});
      const externalValidator = new ExternalApiValidator(true); // Will fail
      const businessValidator = Validation.create<User>().addRule(
        'id',
        user => user.id.length > 0,
        'ID cannot be empty'
      );

      // Act
      const combinedValidator = Validation.combine(
        formatValidator,
        Validation.useExternal(externalValidator),
        businessValidator
      );

      const result = combinedValidator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      const errorSources = result.error.errors.map(e => e.property);
      expect(errorSources).toContain('external'); // External API
      expect(errorSources).toContain('id'); // Format + Business
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle nested object validation with adapters', () => {
      // Arrange
      const profileValidator = Validation.create<UserProfile>().addRule(
        'bio',
        profile => profile.bio.length >= 10,
        'Bio must be at least 10 characters'
      );

      const userWithProfile: User = {
        ...validUser,
        profile: { bio: 'Short' },
      };

      const mainValidator = Validation.combine(
        MockZodAdapter.create({}),
        Validation.create<User>()
          .addRule('name', user => user.name.length > 0, 'Name required')
          .addNested('profile', profileValidator, user => user.profile)
      );

      // Act
      const result = mainValidator.validate(userWithProfile);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.some(e => e.property.includes('profile'))).toBe(true);
    });

    it('should handle conditional validation across adapters', () => {
      // Arrange
      const baseValidator = MockZodAdapter.create({});

      const conditionalValidator = Validation.create<User>()
        .when(
          user => user.subscription === 'premium',
          v =>
            v
              .addRule('age', user => user.age >= 21, 'Premium users must be 21+')
              .addRule('email', user => user.email.includes('+'), 'Premium users need + in email')
        )
        .otherwise(v => v.addRule('age', user => user.age >= 13, 'Basic users must be 13+'));

      const premiumUser = { ...validUser, subscription: 'premium' as const, age: 20 };
      const basicUser = { ...validUser, subscription: 'basic' as const, age: 15 };

      // Act
      const validator = Validation.combine(baseValidator, conditionalValidator);
      const premiumResult = validator.validate(premiumUser);
      const basicResult = validator.validate(basicUser);

      // Assert
      expect(premiumResult.isFailure).toBe(true);
      expect(
        premiumResult.error.errors.some(e => e.message.includes('Premium users must be 21+'))
      ).toBe(true);

      expect(basicResult.isSuccess).toBe(true);
    });

    it('should demonstrate real-world e-commerce validation', () => {
      interface Order {
        id: string;
        userId: string;
        items: OrderItem[];
        total: number;
        currency: string;
        status: 'pending' | 'confirmed' | 'shipped';
        shippingAddress: Address;
      }

      interface OrderItem {
        productId: string;
        quantity: number;
        price: number;
      }

      interface Address {
        street: string;
        city: string;
        country: string;
        zipCode: string;
      }

      // Structure validation (like Zod)
      const structureValidator = AdapterUtils.create<Order>(
        order => ({
          success: order.id.length > 0 && order.items.length > 0 && order.total > 0,
          errors:
            order.id.length === 0
              ? ['Order ID required']
              : order.items.length === 0
                ? ['Order must have items']
                : order.total <= 0
                  ? ['Order total must be positive']
                  : undefined,
        }),
        'structure'
      );

      // Business rules
      const businessValidator = Validation.create<Order>()
        .addRule('total', order => order.total >= 1.0, 'Minimum order $1.00')
        .addRule(
          'currency',
          order => ['USD', 'EUR', 'GBP'].includes(order.currency),
          'Invalid currency'
        )
        .when(
          order => order.total > 100,
          v => v.addRule('items', order => order.items.length <= 50, 'Large orders max 50 items')
        );

      // External validation (shipping, payment, etc.)
      const externalValidator = new ExternalApiValidator(false);

      const testOrder: Order = {
        id: 'ORD-123',
        userId: 'USR-456',
        items: [{ productId: 'PROD-1', quantity: 2, price: 25.0 }],
        total: 50.0,
        currency: 'USD',
        status: 'pending',
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA',
          zipCode: '10001',
        },
      };

      // Act
      const orderValidator = Validation.combine(
        structureValidator,
        businessValidator,
        Validation.useExternal(externalValidator)
      );

      const result = orderValidator.validate(testOrder);

      // Assert
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Performance and Error Aggregation', () => {
    it('should collect all validation errors from all adapters', () => {
      // Arrange
      const adapter1 = AdapterUtils.create<User>(
        () => ({ success: false, errors: ['Error 1', 'Error 2'] }),
        'adapter1'
      );

      const adapter2 = AdapterUtils.create<User>(
        () => ({ success: false, errors: ['Error 3'] }),
        'adapter2'
      );

      const adapter3 = Validation.create<User>()
        .addRule('field1', () => false, 'Error 4')
        .addRule('field2', () => false, 'Error 5');

      // Act
      const combinedValidator = Validation.combine(adapter1, adapter2, adapter3);
      const result = combinedValidator.validate(validUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors).toHaveLength(5);

      const messages = result.error.errors.map(e => e.message);
      expect(messages).toContain('Error 1');
      expect(messages).toContain('Error 2');
      expect(messages).toContain('Error 3');
      expect(messages).toContain('Error 4');
      expect(messages).toContain('Error 5');
    });

    it('should short-circuit when first adapter passes and others not applicable', () => {
      // Arrange
      const passingAdapter = AdapterUtils.create<User>(() => ({ success: true }));
      const failingAdapter = AdapterUtils.create<User>(
        () => ({ success: false, errors: ['Should not see this'] }),
        'failing'
      );

      // Act - combine will run all validators even if some pass
      const result1 = Validation.combine(passingAdapter, failingAdapter).validate(validUser);
      const result2 = Validation.combine(failingAdapter, passingAdapter).validate(validUser);

      // Assert - combine runs all validators, so failures are still collected
      expect(result1.isFailure).toBe(true); // Because failingAdapter still runs
      expect(result2.isFailure).toBe(true); // Because failingAdapter still runs
    });
  });
});
