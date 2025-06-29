import { describe, it, expect } from 'vitest';
import type { IValidationErrors } from '@vytches-ddd/contracts';
import type { Result } from '@vytches-ddd/utils';
import { BaseValidationAdapter, AdapterUtils } from './base-adapter';
import { ValidationError, ValidationErrors } from '../validation-error';

// Test concrete implementation of BaseValidationAdapter
class TestValidationAdapter<T> extends BaseValidationAdapter<T, any> {
  constructor(
    schema: any,
    private shouldFail = false,
    private customErrors: ValidationError[] = []
  ) {
    super(schema);
  }

  validate(value: T): Result<T, IValidationErrors> {
    if (this.shouldFail) {
      if (this.customErrors.length > 0) {
        return this.failWithErrors(this.customErrors);
      }
      return this.failWithErrors([
        this.createValidationError('test', 'Test validation failed', { value }),
      ]);
    }
    return this.success(value);
  }
}

interface TestUser {
  name: string;
  email: string;
  age: number;
}

describe('BaseValidationAdapter', () => {
  const validUser: TestUser = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 25,
  };

  const invalidUser: TestUser = {
    name: '',
    email: 'invalid',
    age: 16,
  };

  describe('Helper Methods', () => {
    it('should create validation error with context', () => {
      // Arrange
      const adapter = new TestValidationAdapter({});

      // Act
      const error = adapter['createValidationError']('email', 'Invalid email', {
        code: 'INVALID_FORMAT',
      });

      // Assert
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.property).toBe('email');
      expect(error.message).toBe('Invalid email');
      expect(error.context).toEqual({ code: 'INVALID_FORMAT' });
    });

    it('should create validation errors collection', () => {
      // Arrange
      const adapter = new TestValidationAdapter({});
      const errors = [
        new ValidationError('name', 'Name required'),
        new ValidationError('email', 'Invalid email'),
      ];

      // Act
      const validationErrors = adapter['createValidationErrors'](errors);

      // Assert
      expect(validationErrors).toBeInstanceOf(ValidationErrors);
      expect(validationErrors.errors).toHaveLength(2);
      expect(validationErrors.errors[0]?.property).toBe('name');
      expect(validationErrors.errors[1]?.property).toBe('email');
    });

    it('should convert path array to string', () => {
      // Arrange
      const adapter = new TestValidationAdapter({});

      // Act
      const pathString = adapter['pathToString'](['user', 'profile', 0, 'address', 'street']);

      // Assert
      expect(pathString).toBe('user.profile.0.address.street');
    });

    it('should create failure result with errors', () => {
      // Arrange
      const adapter = new TestValidationAdapter({});
      const errors = [new ValidationError('test', 'Test error')];

      // Act
      const result = adapter['failWithErrors'](errors);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors).toHaveLength(1);
      expect(result.error.errors[0]?.message).toBe('Test error');
    });

    it('should create success result', () => {
      // Arrange
      const adapter = new TestValidationAdapter({});

      // Act
      const result = adapter['success'](validUser);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validUser);
    });
  });

  describe('Validation Behavior', () => {
    it('should pass validation when implementation succeeds', () => {
      // Arrange
      const adapter = new TestValidationAdapter({}, false);

      // Act
      const result = adapter.validate(validUser);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validUser);
    });

    it('should fail validation when implementation fails', () => {
      // Arrange
      const adapter = new TestValidationAdapter({}, true);

      // Act
      const result = adapter.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors).toHaveLength(1);
      expect(result.error.errors[0]?.property).toBe('test');
      expect(result.error.errors[0]?.message).toBe('Test validation failed');
      expect(result.error.errors[0]?.context?.value).toBe(invalidUser);
    });

    it('should fail validation with custom errors', () => {
      // Arrange
      const customErrors = [
        new ValidationError('name', 'Name is required'),
        new ValidationError('email', 'Invalid email format'),
      ];
      const adapter = new TestValidationAdapter({}, true, customErrors);

      // Act
      const result = adapter.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors).toHaveLength(2);
      expect(result.error.errors[0]?.property).toBe('name');
      expect(result.error.errors[1]?.property).toBe('email');
    });
  });
});

describe('AdapterUtils', () => {
  interface TestData {
    name: string;
    email: string;
    age: number;
  }

  const validData: TestData = {
    name: 'John',
    email: 'john@example.com',
    age: 25,
  };

  const invalidData: TestData = {
    name: '',
    email: 'invalid-email',
    age: 15,
  };

  describe('create', () => {
    it('should create adapter from validation function', () => {
      // Arrange
      const validateFn = (data: TestData) => {
        const errors: string[] = [];
        if (data.name.length === 0) errors.push('Name is required');
        if (data.age < 18) errors.push('Must be 18 or older');

        return {
          success: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
        };
      };

      // Act
      const adapter = AdapterUtils.create(validateFn, 'user');
      const successResult = adapter.validate(validData);
      const failureResult = adapter.validate(invalidData);

      // Assert
      expect(successResult.isSuccess).toBe(true);
      expect(successResult.value).toBe(validData);

      expect(failureResult.isFailure).toBe(true);
      expect(failureResult.error.errors).toHaveLength(2); // Both name and age errors
      expect(failureResult.error.errors[0]?.property).toBe('user');
      expect(failureResult.error.errors[0]?.message).toBe('Name is required');
      expect(failureResult.error.errors[1]?.property).toBe('user');
      expect(failureResult.error.errors[1]?.message).toBe('Must be 18 or older');
    });

    it('should handle successful validation', () => {
      // Arrange
      const validateFn = () => ({ success: true });
      const adapter = AdapterUtils.create(validateFn);

      // Act
      const result = adapter.validate(validData);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validData);
    });

    it('should handle multiple errors', () => {
      // Arrange
      const validateFn = () => ({
        success: false,
        errors: ['Error 1', 'Error 2', 'Error 3'],
      });
      const adapter = AdapterUtils.create(validateFn, 'field');

      // Act
      const result = adapter.validate(invalidData);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors).toHaveLength(3);
      expect(result.error.errors.map(e => e.message)).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });
  });

  describe('combine', () => {
    it('should combine multiple adapters successfully', () => {
      // Arrange
      const adapter1 = AdapterUtils.create(
        (data: TestData) => ({
          success: data.name.length > 0,
          errors: data.name.length === 0 ? ['Name required'] : undefined,
        }),
        'name'
      );

      const adapter2 = AdapterUtils.create(
        (data: TestData) => ({
          success: data.age >= 18,
          errors: data.age < 18 ? ['Must be adult'] : undefined,
        }),
        'age'
      );

      const adapter3 = AdapterUtils.create(
        (data: TestData) => ({
          success: data.email.includes('@'),
          errors: !data.email.includes('@') ? ['Invalid email'] : undefined,
        }),
        'email'
      );

      // Act
      const combinedAdapter = AdapterUtils.combine(adapter1, adapter2, adapter3);
      const successResult = combinedAdapter.validate(validData);
      const failureResult = combinedAdapter.validate(invalidData);

      // Assert
      expect(successResult.isSuccess).toBe(true);
      expect(successResult.value).toBe(validData);

      expect(failureResult.isFailure).toBe(true);
      expect(failureResult.error.errors).toHaveLength(3);
      expect(failureResult.error.errors.map(e => e.property)).toEqual(['name', 'age', 'email']);
    });

    it('should pass when all adapters pass', () => {
      // Arrange
      const adapter1 = AdapterUtils.create(() => ({ success: true }));
      const adapter2 = AdapterUtils.create(() => ({ success: true }));

      // Act
      const combinedAdapter = AdapterUtils.combine(adapter1, adapter2);
      const result = combinedAdapter.validate(validData);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validData);
    });

    it('should handle empty adapter list', () => {
      // Act
      const combinedAdapter = AdapterUtils.combine<TestData>();
      const result = combinedAdapter.validate(validData);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validData);
    });
  });

  describe('withErrorMapping', () => {
    interface CustomError {
      code: string;
      field: string;
      description: string;
    }

    it('should map custom errors correctly', () => {
      // Arrange
      const validateFn = (data: TestData) => ({
        success: false,
        errors: [
          { code: 'REQUIRED', field: 'name', description: 'Name is required' },
          { code: 'MIN_AGE', field: 'age', description: 'Must be at least 18' },
        ],
      });

      const errorMapper = (error: CustomError) =>
        new ValidationError(error.field, error.description, { code: error.code });

      // Act
      const adapter = AdapterUtils.withErrorMapping(validateFn, errorMapper);
      const result = adapter.validate(invalidData);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors).toHaveLength(2);
      expect(result.error.errors[0]?.property).toBe('name');
      expect(result.error.errors[0]?.message).toBe('Name is required');
      expect(result.error.errors[0]?.context?.code).toBe('REQUIRED');
      expect(result.error.errors[1]?.property).toBe('age');
      expect(result.error.errors[1]?.message).toBe('Must be at least 18');
      expect(result.error.errors[1]?.context?.code).toBe('MIN_AGE');
    });

    it('should handle successful validation with error mapping', () => {
      // Arrange
      const validateFn = () => ({ success: true });
      const errorMapper = (error: any) => new ValidationError('test', 'Test error');
      const adapter = AdapterUtils.withErrorMapping(validateFn, errorMapper);

      // Act
      const result = adapter.validate(validData);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validData);
    });

    it('should handle undefined errors', () => {
      // Arrange
      const validateFn = () => ({ success: false, errors: undefined });
      const errorMapper = (error: any) => new ValidationError('test', 'Test error');
      const adapter = AdapterUtils.withErrorMapping(validateFn, errorMapper);

      // Act
      const result = adapter.validate(invalidData);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(invalidData);
    });
  });
});
