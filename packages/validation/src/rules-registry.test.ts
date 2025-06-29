import { describe, it, expect, beforeEach } from 'vitest';

import type { ISpecification } from '@vytches-ddd/contracts';

import type { IRulesProvider } from './rules-registry';
import { CoreRules, RulesRegistry } from './rules-registry';
import { BusinessRuleValidator } from './business-rules';

describe('CoreRules', () => {
  interface TestData {
    name: string;
    age: number;
    email: string;
    description?: string;
    premium?: boolean;
  }

  const validData: TestData = {
    name: 'John Doe',
    age: 25,
    email: 'john@example.com',
    description: 'Test description',
  };

  const invalidData: TestData = {
    name: '',
    age: 16,
    email: 'not-an-email',
    description: 'A very long description that exceeds the maximum length limit for testing',
  };

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

  let coreRules: CoreRules;

  beforeEach(() => {
    coreRules = new CoreRules();
  });

  describe('Basic validation rules', () => {
    it('should validate required fields', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.required('name', 'Name is required')
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate({ ...invalidData, name: null as unknown as string });

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Name is required');
    });

    it('should validate minimum length', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.minLength('name', 3, 'Name must be at least 3 characters')
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate({ ...invalidData, name: 'Jo' });

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Name must be at least 3 characters');
    });

    it('should validate maximum length', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.maxLength('description', 20, 'Description is too long')
      );

      // Act
      const validResult = validator.validate({
        ...validData,
        description: 'Short description',
      });
      const invalidResult = validator.validate(invalidData);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Description is too long');
    });

    it('should validate patterns', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.pattern(
          'name',
          /^[A-Z][a-z]+ [A-Z][a-z]+$/,
          'Name must be in format "First Last"'
        )
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate({
        ...invalidData,
        name: 'john doe',
      });

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe(
        'Name must be in format "First Last"'
      );
    });

    it('should validate numeric ranges', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.range('age', 18, 65, 'Age must be between 18 and 65')
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate(invalidData);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Age must be between 18 and 65');
    });

    it('should validate email format', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.email('email', 'Invalid email address')
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate(invalidData);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Invalid email address');
    });
  });

  describe('Specification-based rules', () => {
    it('should validate with satisfies', () => {
      // Arrange
      const isAdult = new TestSpecification<TestData>(data => data.age >= 18);

      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.satisfies(isAdult, 'Must be 18 or older')
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate(invalidData);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Must be 18 or older');
    });

    it('should validate with propertySatisfies', () => {
      // Arrange
      const isLongEnough = new TestSpecification<string>(str => str.length >= 3);

      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.propertySatisfies(
          'name',
          isLongEnough,
          'Name must be at least 3 characters',
          data => data.name
        )
      );

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate({ ...invalidData, name: 'Jo' });

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult?.error?.errors?.[0]?.message).toBe('Name must be at least 3 characters');
    });
  });

  describe('Conditional rules', () => {
    it('should apply rules conditionally with when', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.when(
          data => data.premium === true,
          validator =>
            validator.apply(coreRules.minLength('name', 5, 'Premium users need longer names'))
        )
      );

      // Act
      const regularResult = validator.validate(validData);
      const premiumValidResult = validator.validate({
        ...validData,
        premium: true,
      });
      const premiumInvalidResult = validator.validate({
        ...invalidData,
        name: 'Jane',
        premium: true,
      });

      // Assert
      expect(regularResult.isSuccess).toBe(true);
      expect(premiumValidResult.isSuccess).toBe(true);
      expect(premiumInvalidResult.isFailure).toBe(true);
      expect(premiumInvalidResult?.error?.errors?.[0]?.message).toBe(
        'Premium users need longer names'
      );
    });

    it('should apply rules conditionally with whenSatisfies', () => {
      // Arrange
      const isPremium = new TestSpecification<TestData>(data => data.premium === true);

      const validator = BusinessRuleValidator.create<TestData>().apply(
        coreRules.whenSatisfies(isPremium, validator =>
          validator.apply(coreRules.minLength('name', 5, 'Premium users need longer names'))
        )
      );

      // Act
      const regularResult = validator.validate(validData);
      const premiumValidResult = validator.validate({
        ...validData,
        premium: true,
      });
      const premiumInvalidResult = validator.validate({
        ...invalidData,
        name: 'Jane',
        premium: true,
      });

      // Assert
      expect(regularResult.isSuccess).toBe(true);
      expect(premiumValidResult.isSuccess).toBe(true);
      expect(premiumInvalidResult.isFailure).toBe(true);
      expect(premiumInvalidResult?.error?.errors?.[0]?.message).toBe(
        'Premium users need longer names'
      );
    });

    it('should apply otherwise rules', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>()
        .when(
          data => data.premium === true,
          validator =>
            validator.addRule(
              'name',
              user => user.name.length >= 5,
              'Premium users need longer names'
            )
        )
        .otherwise(validator =>
          validator.addRule(
            'name',
            user => user.name.length >= 2,
            'Regular users need at least 2 chars'
          )
        );

      // Act
      const regularValidResult = validator.validate({
        ...validData,
        name: 'Jo',
      });
      const regularInvalidResult = validator.validate({
        ...invalidData,
        name: 'J',
      });
      const premiumValidResult = validator.validate({
        ...validData,
        premium: true,
      });
      const premiumInvalidResult = validator.validate({
        ...invalidData,
        name: 'Jane',
        premium: true,
      });

      // Assert
      expect(regularValidResult.isSuccess).toBe(true);
      expect(regularInvalidResult.isFailure).toBe(true);
      expect(regularInvalidResult?.error?.errors?.[0]?.message).toBe(
        'Regular users need at least 2 chars'
      );
      expect(premiumValidResult.isSuccess).toBe(true);
      expect(premiumInvalidResult.isFailure).toBe(true);
      expect(premiumInvalidResult?.error?.errors?.[0]?.message).toBe(
        'Premium users need longer names'
      );
    });
  });

  describe('Chaining multiple rules', () => {
    it('should apply multiple rules in sequence', () => {
      // Arrange
      const validator = BusinessRuleValidator.create<TestData>()
        .apply(coreRules.required('name', 'Name is required'))
        .apply(coreRules.minLength('name', 3, 'Name must be at least 3 characters'))
        .apply(coreRules.email('email', 'Invalid email format'))
        .apply(coreRules.range('age', 18, 65, 'Age must be between 18 and 65'));

      // Act
      const validResult = validator.validate(validData);
      const invalidResult = validator.validate(invalidData);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error.errors.length).toBe(3); // name length, email, age
    });
  });

  describe('Provider metadata', () => {
    it('should identify itself with a name', () => {
      // Act & Assert
      expect(coreRules.name).toBe('core');
    });
  });
});

describe('RulesRegistry', () => {
  // Create test rule providers
  class TestRuleProvider implements IRulesProvider {
    readonly name = 'test-provider';
  }

  class AnotherRuleProvider implements IRulesProvider {
    readonly name = 'another-provider';
  }

  // Clear registry before each test to ensure isolation
  beforeEach(() => {
    // Reset the registry (assuming there's a method to do this, or use private field access for testing)
    // Note: You might need to create a method like `RulesRegistry.reset()` for testing
    RulesRegistry['providers'] = new Map();
    // Register CoreRules as it's needed by most tests
    RulesRegistry.register(new CoreRules());
  });

  describe('register', () => {
    it('should register a rule provider', () => {
      // Arrange
      const provider = new TestRuleProvider();

      // Act
      RulesRegistry.register(provider);

      // Assert
      expect(() => RulesRegistry.getProvider('test-provider')).not.toThrow();
    });

    it('should throw error when registering a provider with duplicate name', () => {
      // Arrange
      const provider1 = new TestRuleProvider();
      const provider2 = new TestRuleProvider(); // Same name
      RulesRegistry.register(provider1);

      // Act & Assert
      expect(() => RulesRegistry.register(provider2)).toThrow(
        'Rule provider with name "test-provider" is already registered'
      );
    });
  });

  describe('getProvider', () => {
    it('should retrieve a registered provider', () => {
      // Arrange
      const provider = new TestRuleProvider();
      RulesRegistry.register(provider);

      // Act
      const retrieved = RulesRegistry.getProvider<TestRuleProvider>('test-provider');

      // Assert
      expect(retrieved).toBe(provider);
      expect(retrieved.name).toBe('test-provider');
    });

    it('should throw error when getting a non-existent provider', () => {
      // Act & Assert
      expect(() => RulesRegistry.getProvider('non-existent')).toThrow(
        'Rule provider "non-existent" not found'
      );
    });
  });

  describe('Rules', () => {
    it('should provide access to core rules', () => {
      // Act
      const rules = RulesRegistry.Rules;

      // Assert
      expect(rules).toBeInstanceOf(CoreRules);
    });

    it('should provide core rules with all expected methods', () => {
      // Act
      const rules = RulesRegistry.Rules;

      // Assert
      expect(rules.required).toBeInstanceOf(Function);
      expect(rules.minLength).toBeInstanceOf(Function);
      expect(rules.maxLength).toBeInstanceOf(Function);
      expect(rules.pattern).toBeInstanceOf(Function);
      expect(rules.range).toBeInstanceOf(Function);
      expect(rules.email).toBeInstanceOf(Function);
      expect(rules.satisfies).toBeInstanceOf(Function);
      expect(rules.propertySatisfies).toBeInstanceOf(Function);
      expect(rules.when).toBeInstanceOf(Function);
      expect(rules.whenSatisfies).toBeInstanceOf(Function);
      expect(rules.otherwise).toBeInstanceOf(Function);
    });
  });

  describe('forDomain', () => {
    it('should retrieve a domain-specific rule provider', () => {
      // Arrange
      const provider = new TestRuleProvider();
      RulesRegistry.register(provider);

      // Act
      const retrieved = RulesRegistry.forDomain<TestRuleProvider>('test-provider');

      // Assert
      expect(retrieved).toBe(provider);
    });

    it('should throw error when domain does not exist', () => {
      // Act & Assert
      expect(() => RulesRegistry.forDomain('non-existent')).toThrow(
        'Rule provider "non-existent" not found'
      );
    });

    it('should handle multiple domains', () => {
      // Arrange
      const provider1 = new TestRuleProvider();
      const provider2 = new AnotherRuleProvider();
      RulesRegistry.register(provider1);
      RulesRegistry.register(provider2);

      // Act & Assert
      expect(RulesRegistry.forDomain('test-provider')).toBe(provider1);
      expect(RulesRegistry.forDomain('another-provider')).toBe(provider2);
    });
  });
});
