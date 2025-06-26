/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {describe, it, expect } from 'vitest'
import type { ISpecification } from '@vytches-ddd/contracts';
import { BusinessRuleValidator } from './business-rule-validator';

// Create a test specification for use in tests
class TestSpecification<T> implements ISpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {}

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }

  and(other: ISpecification<T>): ISpecification<T> {
    return new TestSpecification<T>(
      (candidate) =>
        this.isSatisfiedBy(candidate) && other.isSatisfiedBy(candidate),
    );
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new TestSpecification<T>(
      (candidate) =>
        this.isSatisfiedBy(candidate) || other.isSatisfiedBy(candidate),
    );
  }

  not(): ISpecification<T> {
    return new TestSpecification<T>(
      (candidate) => !this.isSatisfiedBy(candidate),
    );
  }
}

describe('BusinessRuleValidator', () => {
  // Test interface
  interface TestUser {
    name: string;
    age: number;
    email: string;
    premium?: boolean;
    address?: {
      street: string;
      city: string;
      zip: string;
    };
  }

  // Test data
  const validUser: TestUser = {
    name: 'John Doe',
    age: 25,
    email: 'john@example.com',
  };

  const invalidUser: TestUser = {
    name: '', // Invalid: empty
    age: 16, // Invalid: too young
    email: 'invalid-email', // Invalid: not email format
  };

  describe('Basic validation', () => {
    it('should validate successfully when all rules pass', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>().addRule(
        'name',
        (user) => user.name.length > 0,
        'Name is required',
      );

      // Act
      const result = validator.validate(validUser);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(validUser);
    });

    it('should fail validation when a rule fails', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>().addRule(
        'name',
        (user) => user.name.length > 0,
        'Name is required',
      );

      // Act
      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result?.error?.errors?.[0]?.property).toBe('name');
      expect(result?.error?.errors?.[0]?.message).toBe('Name is required');
    });

    it('should collect all validation errors by default', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>()
        .addRule('name', (user) => user.name.length > 0, 'Name is required')
        .addRule('age', (user) => user.age >= 18, 'Must be 18 or older')
        .addRule(
          'email',
          (user) => /^\S+@\S+\.\S+$/.test(user.email),
          'Invalid email format',
        );

      // Act
      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.length).toBe(3);
    });
  });

  describe('Specification integration', () => {
    it('should validate using mustSatisfy with specifications', () => {
      // Arrange
      const isAdult = new TestSpecification<TestUser>((user) => user.age >= 18);

      const validator = BusinessRuleValidator.create<TestUser>().mustSatisfy(
        isAdult,
        'User must be 18 or older',
      );

      // Act
      const validResult = validator.validate(validUser);
      const invalidResult = validator.validate(invalidUser);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe(
        'User must be 18 or older',
      );
    });

    it('should validate property with propertyMustSatisfy', () => {
      // Arrange
      const validEmail = new TestSpecification<string>((email) =>
        /^\S+@\S+\.\S+$/.test(email),
      );

      const validator =
        BusinessRuleValidator.create<TestUser>().propertyMustSatisfy(
          'email',
          validEmail,
          'Invalid email format',
          (user) => user.email,
        );

      // Act
      const validResult = validator.validate(validUser);
      const invalidResult = validator.validate(invalidUser);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.property).toBe('email');
      expect(invalidResult?.error?.errors?.[0]?.message).toBe(
        'Invalid email format',
      );
    });
  });

  describe('Conditional validation', () => {
    it('should apply rules conditionally with when', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>().when(
        (user) => user.premium === true,
        (v) =>
          v.addRule(
            'name',
            (user) => user.name.length >= 3,
            'Premium users need longer names',
          ),
      );

      const premiumUser = { ...validUser, premium: true, name: 'Jo' }; // Too short for premium

      // Act
      const regularResult = validator.validate(validUser); // No premium, rule not applied
      const premiumResult = validator.validate(premiumUser); // Premium, rule applied

      // Assert
      expect(regularResult.isSuccess).toBe(true);
      expect(premiumResult.isFailure).toBe(true);
      expect(premiumResult?.error?.errors?.[0]?.message).toBe(
        'Premium users need longer names',
      );
    });

    it('should apply conditional rules with otherwise', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>()
        .when(
          (user) => user.premium === true,
          (v) =>
            v.addRule(
              'name',
              (user) => user.name.length >= 3,
              'Premium users need longer names',
            ),
        )
        .otherwise((v) =>
          v.addRule(
            'name',
            (user) => user.name.length >= 2,
            'Regular users need at least 2 chars',
          ),
        );

      const shortNameUser = { ...validUser, name: 'J' }; // Too short for regular
      const regularUser = { ...validUser, name: 'Jo' }; // OK for regular, too short for premium
      const premiumUser = { ...validUser, premium: true, name: 'Jo' }; // Too short for premium

      // Act
      const shortResult = validator.validate(shortNameUser);
      const regularResult = validator.validate(regularUser);
      const premiumResult = validator.validate(premiumUser);

      // Assert
      expect(shortResult.isFailure).toBe(true);
      expect(shortResult?.error?.errors?.[0]?.message).toBe(
        'Regular users need at least 2 chars',
      );
      expect(regularResult.isSuccess).toBe(true);
      expect(premiumResult.isFailure).toBe(true);
      expect(premiumResult?.error?.errors?.[0]?.message).toBe(
        'Premium users need longer names',
      );
    });

    it('should apply conditional rules with whenSatisfies using specifications', () => {
      // Arrange
      const isPremium = new TestSpecification<TestUser>(
        (user) => user.premium === true,
      );

      const validator = BusinessRuleValidator.create<TestUser>().whenSatisfies(
        isPremium,
        (v) =>
          v.addRule(
            'name',
            (user) => user.name.length >= 3,
            'Premium users need longer names',
          ),
      );

      const premiumUser = { ...validUser, premium: true, name: 'Jo' }; // Too short for premium

      // Act
      const regularResult = validator.validate(validUser);
      const premiumResult = validator.validate(premiumUser);

      // Assert
      expect(regularResult.isSuccess).toBe(true);
      expect(premiumResult.isFailure).toBe(true);
      expect(premiumResult?.error?.errors?.[0]?.message).toBe(
        'Premium users need longer names',
      );
    });
  });

  describe('Nested validation', () => {
    it('should validate nested objects', () => {
      // Arrange
      const addressValidator = BusinessRuleValidator.create<
        TestUser['address']
      >()
        .addRule(
          'street',
          (addr) => (addr?.street?.length ?? 0) > 0,
          'Street is required',
        )
        .addRule('zip', (addr) => /^\d{5}$/.test(addr!.zip), 'Invalid ZIP code');

      const validator = BusinessRuleValidator.create<TestUser>().when(
        (user) => user.address !== undefined,
        (v) => v.addNested('address', addressValidator, (user) => user.address),
      );

      const userWithInvalidAddress = {
        ...validUser,
        address: {
          street: '',
          city: 'New York',
          zip: 'invalid',
        },
      };

      // Act
      const result = validator.validate(userWithInvalidAddress);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.length).toBe(1); // Nested validation creates one top-level error
      expect(result?.error?.errors?.[0]?.property).toBe('address');
    });
  });

  describe('Validation control flow', () => {
    it('should stop on first failure when setStopOnFirstFailure is used', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestUser>()
        .addRule('name', (user) => user.name.length > 0, 'Name is required')
        .addRule('age', (user) => user.age >= 18, 'Must be 18 or older')
        .addRule(
          'email',
          (user) => /^\S+@\S+\.\S+$/.test(user.email),
          'Invalid email format',
        )
        .setStopOnFirstFailure();

      // Act
      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.length).toBe(1); // Only first error is captured
    });
  });

  describe('Validator composition', () => {
    it('should combine validators with and', () => {
      // Arrange
      const nameValidator = BusinessRuleValidator.create<TestUser>().addRule(
        'name',
        (user) => user.name.length > 0,
        'Name is required',
      );

      const ageValidator = BusinessRuleValidator.create<TestUser>().addRule(
        'age',
        (user) => user.age >= 18,
        'Must be 18 or older',
      );

      // Act
      const combinedValidator = nameValidator.and(ageValidator);
      const result = combinedValidator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Static factory methods', () => {
    it('should create validator from specification', () => {
      // Arrange
      const isAdult = new TestSpecification<TestUser>((user) => user.age >= 18);

      // Act
      const validator = BusinessRuleValidator.fromSpecification(
        isAdult,
        'Must be 18 or older',
      );
      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result?.error?.errors?.[0]?.message).toBe('Must be 18 or older');
    });
  });
});
