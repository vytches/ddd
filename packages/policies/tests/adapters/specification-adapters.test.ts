import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { BusinessRuleValidator } from '@vytches/ddd-validation';
import type { ISpecification } from '@vytches/ddd-contracts';
import {
  BusinessRuleValidatorAdapter,
  BusinessRuleValidatorPolicy,
  PolicySpecificationFactory,
} from '../../src/adapters/specification-adapters';
import { PolicyContextBuilder } from '../../src/utils/policy-context-builder';
import { PolicyViolation } from '../../src/core/models/policy-violation';

// Test entity
interface TestUser {
  name: string;
  age: number;
  email: string;
}

// Simple test specification
class AgeSpecification implements ISpecification<TestUser> {
  constructor(private readonly minAge: number) {}

  public readonly name = 'AgeSpecification';
  public readonly description = 'Validates minimum age requirement';

  public isSatisfiedBy(candidate: TestUser): boolean {
    return candidate.age >= this.minAge;
  }

  public explainFailure(candidate: TestUser): string | null {
    if (candidate.age < this.minAge) {
      return `Age ${candidate.age} is below minimum required age ${this.minAge}`;
    }
    return null;
  }

  public and(other: ISpecification<TestUser>): ISpecification<TestUser> {
    throw new Error('Not implemented for test');
  }

  public or(other: ISpecification<TestUser>): ISpecification<TestUser> {
    throw new Error('Not implemented for test');
  }

  public not(): ISpecification<TestUser> {
    throw new Error('Not implemented for test');
  }
}

describe('Specification Adapters', () => {
  let testUser: TestUser;
  let validUser: TestUser;
  let policyContext: any;

  beforeEach(() => {
    testUser = {
      name: 'John',
      age: 16,
      email: 'john@example.com',
    };

    validUser = {
      name: 'Jane',
      age: 25,
      email: 'jane@example.com',
    };

    policyContext = PolicyContextBuilder.forUser('test-user').withEnvironment('test').build();
  });

  describe('BusinessRuleValidatorAdapter', () => {
    it('should adapt BusinessRuleValidator to ISpecification', () => {
      const validator = new BusinessRuleValidator<TestUser>()
        .addRule('age', user => user.age >= 18, 'User must be at least 18 years old')
        .addRule('name', user => user.name.length >= 2, 'Name must be at least 2 characters');

      const adapter = BusinessRuleValidatorAdapter.create(
        validator,
        'UserValidation',
        'Validates user data'
      );

      // Test specification interface
      expect(adapter.name).toBe('UserValidation');
      expect(adapter.description).toBe('Validates user data');

      // Test invalid user
      expect(adapter.isSatisfiedBy(testUser)).toBe(false);
      const explanation = adapter.explainFailure(testUser);
      expect(explanation).toContain('18 years old');

      // Test valid user
      expect(adapter.isSatisfiedBy(validUser)).toBe(true);
      expect(adapter.explainFailure(validUser)).toBeNull();
    });

    it('should handle validation errors gracefully', () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'age',
        () => {
          throw new Error('Validation error');
        },
        'Age validation'
      );

      const adapter = BusinessRuleValidatorAdapter.create(validator);

      // Should handle errors gracefully
      expect(adapter.isSatisfiedBy(testUser)).toBe(false);
      const explanation = adapter.explainFailure(testUser);
      expect(explanation).toContain('Business rule validation failed');
    });

    it('should provide default name when not specified', () => {
      const validator = new BusinessRuleValidator<TestUser>();
      const adapter = BusinessRuleValidatorAdapter.create(validator);

      expect(adapter.name).toBeUndefined();
      expect(adapter.description).toBeUndefined();
    });
  });

  describe('BusinessRuleValidatorPolicy', () => {
    it('should create policy from BusinessRuleValidator', async () => {
      const validator = new BusinessRuleValidator<TestUser>()
        .addRule('age', user => user.age >= 18, 'User must be at least 18 years old')
        .addRule('email', user => user.email.includes('@'), 'Email must contain @');

      const policy = BusinessRuleValidatorPolicy.fromValidator(
        'user-validation',
        'users',
        'User Validation Policy',
        validator,
        'USER_VALIDATION_FAILED'
      );

      expect(policy.id).toBe('user-validation');
      expect(policy.domain).toBe('users');
      expect(policy.name).toBe('User Validation Policy');

      // Test with invalid user
      const invalidRequest = { entity: testUser, context: policyContext };
      const invalidResult = await policy.check(invalidRequest);

      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error).toBeInstanceOf(PolicyViolation);
      expect(invalidResult.error.code).toBe('USER_VALIDATION_FAILED');
      expect(invalidResult.error.message).toContain('18 years old');

      // Test with valid user
      const validRequest = { entity: validUser, context: policyContext };
      const validResult = await policy.check(validRequest);

      expect(validResult.isSuccess).toBe(true);
      expect(validResult.value).toBe(validUser);
    });

    it('should handle validation exceptions', async () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'age',
        () => {
          throw new Error('Validation crashed');
        },
        'Age validation'
      );

      const policy = BusinessRuleValidatorPolicy.fromValidator(
        'failing-policy',
        'test',
        'Failing Policy',
        validator
      );

      const request = { entity: testUser, context: policyContext };
      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
      expect(result.error.message).toContain('Business rule validation failed');
    });

    it('should use default error code when not specified', async () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'age',
        user => user.age >= 21,
        'Must be 21 or older'
      );

      const policy = BusinessRuleValidatorPolicy.fromValidator(
        'age-policy',
        'test',
        'Age Policy',
        validator
      );

      const request = { entity: testUser, context: policyContext };
      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('BUSINESS_RULE_VIOLATION');
    });
  });

  describe('PolicySpecificationFactory', () => {
    it('should create policy from ISpecification', async () => {
      const ageSpec = new AgeSpecification(18);

      const policy = PolicySpecificationFactory.fromSpecification(
        'age-policy',
        'users',
        'Age Policy',
        ageSpec,
        {
          errorCode: 'AGE_TOO_LOW',
          errorMessage: 'User is too young',
        }
      );

      expect(policy.id).toBe('age-policy');
      expect(policy.domain).toBe('users');
      expect(policy.name).toBe('Age Policy');

      // Test invalid
      const invalidRequest = { entity: testUser, context: policyContext };
      const invalidResult = await policy.check(invalidRequest);

      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error.code).toBe('AGE_TOO_LOW');

      // Test valid
      const validRequest = { entity: validUser, context: policyContext };
      const validResult = await policy.check(validRequest);

      expect(validResult.isSuccess).toBe(true);
    });

    it('should create policy from BusinessRuleValidator', async () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'name',
        user => user.name.length >= 5,
        'Name must be at least 5 characters'
      ); // John is 4 chars

      const policy = PolicySpecificationFactory.fromBusinessRuleValidator(
        'name-policy',
        'users',
        'Name Policy',
        validator,
        'INVALID_NAME'
      );

      const request = { entity: testUser, context: policyContext }; // John has 4 chars
      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_NAME');
    });

    it('should create specification adapter from BusinessRuleValidator', () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'email',
        user => user.email.includes('.'),
        'Email must contain dot'
      );

      const adapter = PolicySpecificationFactory.businessRuleValidatorToSpecification(
        validator,
        'EmailValidator',
        'Validates email format'
      );

      expect(adapter.name).toBe('EmailValidator');
      expect(adapter.description).toBe('Validates email format');
      expect(adapter.isSatisfiedBy(testUser)).toBe(true); // john@example.com has dot
    });

    it('should create policy from BusinessRuleValidator via specification adapter', async () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'age',
        user => user.age >= 21,
        'Must be 21+'
      );

      const policy = PolicySpecificationFactory.fromBusinessRuleValidatorAsSpecification(
        'drinking-age',
        'legal',
        'Drinking Age Policy',
        validator,
        {
          errorCode: 'UNDERAGE',
          errorMessage: 'Not old enough to drink',
          specificationName: 'DrinkingAgeSpec',
          specificationDescription: 'Validates drinking age',
        }
      );

      const request = { entity: testUser, context: policyContext };
      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('UNDERAGE');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty BusinessRuleValidator', async () => {
      const validator = new BusinessRuleValidator<TestUser>();

      const policy = BusinessRuleValidatorPolicy.fromValidator(
        'empty-policy',
        'test',
        'Empty Policy',
        validator
      );

      const request = { entity: testUser, context: policyContext };
      const result = await policy.check(request);

      // Empty validator should pass
      expect(result.isSuccess).toBe(true);
    });

    it('should extract complex error messages', async () => {
      const validator = new BusinessRuleValidator<TestUser>()
        .addRule('name', user => user.name !== 'John', 'Name cannot be John')
        .addRule('age', user => user.age !== 16, 'Age cannot be 16');

      const policy = BusinessRuleValidatorPolicy.fromValidator(
        'complex-policy',
        'test',
        'Complex Policy',
        validator
      );

      const request = { entity: testUser, context: policyContext };
      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('John');
    });

    it('should handle malformed validation results', async () => {
      // Create a validator that returns malformed result
      const validator = {
        validate: () => ({ isSuccess: false, error: { weird: 'object' } }),
      } as unknown as BusinessRuleValidator<TestUser>;

      const policy = new BusinessRuleValidatorPolicy(
        'malformed',
        'test',
        'Malformed Policy',
        validator
      );

      const request = { entity: testUser, context: policyContext };
      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Business rule validation failed');
    });
  });

  describe('Specification Composition', () => {
    it('should compose specifications with AND', () => {
      const validator1 = new BusinessRuleValidator<TestUser>().addRule(
        'age',
        user => user.age >= 18,
        'Must be 18+'
      );
      const validator2 = new BusinessRuleValidator<TestUser>().addRule(
        'name',
        user => user.name.length >= 2,
        'Name too short'
      );

      const adapter1 = BusinessRuleValidatorAdapter.create(validator1, 'Age');
      const adapter2 = BusinessRuleValidatorAdapter.create(validator2, 'Name');

      const composed = adapter1.and(adapter2);

      expect(composed.name).toBe('Age AND Name');
      expect(composed.isSatisfiedBy(testUser)).toBe(false); // age < 18
      expect(composed.isSatisfiedBy(validUser)).toBe(true); // both pass
    });

    it('should compose specifications with OR', () => {
      const validator1 = new BusinessRuleValidator<TestUser>().addRule(
        'age',
        user => user.age >= 50,
        'Must be senior'
      );
      const validator2 = new BusinessRuleValidator<TestUser>().addRule(
        'name',
        user => user.name === 'VIP',
        'Must be VIP'
      );

      const adapter1 = BusinessRuleValidatorAdapter.create(validator1, 'Senior');
      const adapter2 = BusinessRuleValidatorAdapter.create(validator2, 'VIP');

      const composed = adapter1.or(adapter2);

      expect(composed.name).toBe('Senior OR VIP');
      expect(composed.isSatisfiedBy(testUser)).toBe(false); // neither passes
      expect(composed.isSatisfiedBy({ ...testUser, name: 'VIP' })).toBe(true); // VIP passes
    });

    it('should negate specifications', () => {
      const validator = new BusinessRuleValidator<TestUser>().addRule(
        'name',
        user => user.name === 'John',
        'Must be John'
      );

      const adapter = BusinessRuleValidatorAdapter.create(validator, 'JohnOnly');
      const negated = adapter.not();

      expect(negated.name).toBe('NOT JohnOnly');
      expect(negated.isSatisfiedBy(testUser)).toBe(false); // name IS John
      expect(negated.isSatisfiedBy(validUser)).toBe(true); // name is NOT John
    });
  });
});
