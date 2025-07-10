import type { ISpecification } from '@vytches-ddd/contracts';
import { describe, it, expect } from 'vitest';
import { BusinessRuleValidator } from '../../src/business-rule-validator';
import './business-rule-validator-extension'; // Import extension to add methods to prototype

// Create a test specification
class TestSpecification<T> implements ISpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {}

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }

  and(other: ISpecification<T>): ISpecification<T> {
    return new TestSpecification<T>(
      candidate => this.isSatisfiedBy(candidate) && other.isSatisfiedBy(candidate)
    );
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new TestSpecification<T>(
      candidate => this.isSatisfiedBy(candidate) || other.isSatisfiedBy(candidate)
    );
  }

  not(): ISpecification<T> {
    return new TestSpecification<T>(candidate => !this.isSatisfiedBy(candidate));
  }
}

describe('BusinessRuleValidatorExtension', () => {
  interface TestUser {
    name: string;
    age: number;
    email: string;
  }

  const validUser: TestUser = {
    name: 'John Doe',
    age: 25,
    email: 'john@example.com',
  };

  const invalidUser: TestUser = {
    name: '',
    age: 16,
    email: 'invalid',
  };

  describe('toSpecification', () => {
    it('should convert validator to specification', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>().addRule(
        'age',
        user => user.age >= 18,
        'Must be 18 or older'
      );

      // Act
      const specification = validator.toSpecification();

      // Assert
      expect(specification.isSatisfiedBy(validUser)).toBe(true);
      expect(specification.isSatisfiedBy(invalidUser)).toBe(false);
    });

    it('should convert validator with multiple rules to specification', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>()
        .addRule('name', user => user.name.length > 0, 'Name is required')
        .addRule('age', user => user.age >= 18, 'Must be 18 or older');

      // Act
      const specification = validator.toSpecification();

      // Assert
      expect(specification.isSatisfiedBy(validUser)).toBe(true);
      expect(specification.isSatisfiedBy(invalidUser)).toBe(false);
    });
  });

  describe('validateWithSpecifications', () => {
    it('should validate with additional specifications', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>().addRule(
        'name',
        user => user.name.length > 0,
        'Name is required'
      );

      const isAdult = new TestSpecification<TestUser>(user => user.age >= 18);
      const hasValidEmail = new TestSpecification<TestUser>(user =>
        /^\S+@\S+\.\S+$/.test(user.email)
      );

      // Act
      const result = validator.validateWithSpecifications(invalidUser, isAdult, hasValidEmail);

      // Assert
      expect(result.isFailure).toBe(true);
      // Should have errors from both the validator and the specifications
      expect(result.error.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should succeed when validator and all specifications are satisfied', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>().addRule(
        'name',
        user => user.name.length > 0,
        'Name is required'
      );

      const isAdult = new TestSpecification<TestUser>(user => user.age >= 18);
      const hasValidEmail = new TestSpecification<TestUser>(user =>
        /^\S+@\S+\.\S+$/.test(user.email)
      );

      // Act
      const result = validator.validateWithSpecifications(validUser, isAdult, hasValidEmail);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validUser);
    });
  });

  describe('apply', () => {
    it('should apply rule functions to the validator', () => {
      // Arrange
      const addAgeRule = <T extends { age: number }>(
        validator: BusinessRuleValidator<T>
      ): BusinessRuleValidator<T> => {
        return validator.addRule('age', obj => obj.age >= 18, 'Must be 18 or older');
      };

      // Act
      const validator = BusinessRuleValidator.create<TestUser>().apply(addAgeRule);

      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result?.error?.errors?.[0]?.property).toBe('age');
      expect(result?.error?.errors?.[0]?.message).toBe('Must be 18 or older');
    });

    it('should chain multiple rule functions', () => {
      // Arrange
      const addAgeRule = <T extends { age: number }>(
        validator: BusinessRuleValidator<T>
      ): BusinessRuleValidator<T> => {
        return validator.addRule('age', obj => obj.age >= 18, 'Must be 18 or older');
      };

      const addNameRule = <T extends { name: string }>(
        validator: BusinessRuleValidator<T>
      ): BusinessRuleValidator<T> => {
        return validator.addRule('name', obj => obj.name.length > 0, 'Name is required');
      };

      // Act
      const validator = BusinessRuleValidator.create<TestUser>()
        .apply(addAgeRule)
        .apply(addNameRule);

      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.length).toBe(2);
    });
  });
});
