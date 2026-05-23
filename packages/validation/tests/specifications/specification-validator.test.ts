import { describe, it, expect } from 'vitest';

import type { ISpecification } from '@vytches/ddd-contracts';
import { Result } from '@vytches/ddd-utils';

import { Specification, SpecificationValidator } from '../../src';

describe('SpecificationValidator', () => {
  // Test data
  interface TestUser {
    id: number;
    username: string;
    email: string;
    age: number;
    isActive: boolean;
  }

  const validUser: TestUser = {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    age: 25,
    isActive: true,
  };

  const invalidUser: TestUser = {
    id: 2,
    username: 'j', // Too short
    email: 'not-an-email',
    age: 15, // Too young
    isActive: false,
  };

  // Helper function to create specifications
  const createUsernameSpec = (): ISpecification<string> => {
    return Specification.create<string>(username => username.length >= 3);
  };

  const createEmailSpec = (): ISpecification<string> => {
    return Specification.create<string>(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  };

  const createAgeSpec = (): ISpecification<number> => {
    return Specification.create<number>(age => age >= 18);
  };

  describe('Basic Validation', () => {
    it('should pass validation for valid object', () => {
      // Arrange
      const validator = new SpecificationValidator<TestUser>();

      const usernameSpec = Specification.create<TestUser>(user => user.username.length >= 3);
      const emailSpec = Specification.create<TestUser>(user =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
      );
      const ageSpec = Specification.create<TestUser>(user => user.age >= 18);

      validator
        .addRule(usernameSpec, 'Username must be at least 3 characters long', 'username')
        .addRule(emailSpec, 'Email must be valid', 'email')
        .addRule(ageSpec, 'Age must be at least 18', 'age');

      // Act
      const result = validator.validate(validUser);

      // Assert
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual(validUser);
    });

    it('should fail validation for invalid object', () => {
      // Arrange
      const validator = new SpecificationValidator<TestUser>();

      const usernameSpec = Specification.create<TestUser>(user => user.username.length >= 3);
      const emailSpec = Specification.create<TestUser>(user =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
      );
      const ageSpec = Specification.create<TestUser>(user => user.age >= 18);

      validator
        .addRule(usernameSpec, 'Username must be at least 3 characters long', 'username')
        .addRule(emailSpec, 'Email must be valid', 'email')
        .addRule(ageSpec, 'Age must be at least 18', 'age');

      // Act
      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.errors.length).toBe(3);
    });
  });

  describe('Property-specific validation', () => {
    it('should validate specific properties', () => {
      // Arrange
      const validator = new SpecificationValidator<TestUser>();

      validator.addPropertyRule<string>(
        'username',
        createUsernameSpec(),
        'Username must be at least 3 characters long',
        user => user.username
      );

      validator.addPropertyRule<string>(
        'email',
        createEmailSpec(),
        'Email must be valid',
        user => user.email
      );

      validator.addPropertyRule<number>(
        'age',
        createAgeSpec(),
        'Age must be at least 18',
        user => user.age
      );

      // Act
      const resultValid = validator.validate(validUser);
      const resultInvalid = validator.validate(invalidUser);

      // Assert
      expect(resultValid.isSuccess).toBe(true);
      expect(resultInvalid.isFailure).toBe(true);
    });
  });

  describe('Factory methods', () => {
    it('fromSpecification should create a validator with a single rule', () => {
      // Arrange
      const ageSpec = Specification.create<TestUser>(user => user.age >= 18);
      const validator = SpecificationValidator.fromSpecification(
        ageSpec,
        'Age must be at least 18',
        'age'
      );

      // Act
      const resultValid = validator.validate(validUser);
      const resultInvalid = validator.validate(invalidUser);

      // Assert - Valid user
      expect(resultValid.isSuccess).toBe(true);
      expect(resultInvalid.isFailure).toBe(true);

      const validationErrors = resultInvalid.error;
      expect(validationErrors.errors.length).toBe(1);
      expect(validationErrors?.errors?.[0]?.property).toBe('age');
    });

    it('create should create an empty validator', () => {
      // Arrange
      const validator = SpecificationValidator.create<TestUser>();

      // Act
      const result = validator.validate(validUser);

      // Assert
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Context in validation errors', () => {
    it('should include context in validation errors', () => {
      // Arrange
      const ageSpec = Specification.create<TestUser>(user => user.age >= 18);
      const context = { minAge: 18, field: 'age' };

      const validator = SpecificationValidator.fromSpecification(
        ageSpec,
        'Age must be at least {minAge}',
        'age',
        context
      );

      // Act
      const result = validator.validate(invalidUser);

      // Assert
      expect(result.isFailure).toBe(true);

      const validationErrors = result.error;
      expect(validationErrors.errors.length).toBe(1);
      expect(validationErrors?.errors?.[0]?.context).toEqual(context);
    });
  });
});
