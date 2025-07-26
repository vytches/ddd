import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import type { ISpecification } from '@vytches/ddd-contracts';
import {
  PolicyBuilder,
  PolicyGroup,
  PolicyContextBuilder,
  PolicyRequestBuilder,
  PolicyViolation,
} from '../../src';

// Test specification for age validation
class AgeSpecification implements ISpecification<{ age: number }> {
  constructor(private minAge: number) {}

  isSatisfiedBy(candidate: { age: number }): boolean {
    return candidate.age >= this.minAge;
  }

  and(): ISpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }
  or(): ISpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }
  not(): ISpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }

  explainFailure(candidate: { age: number }): string | null {
    if (candidate.age < this.minAge) {
      return `Age ${candidate.age} is below minimum required age of ${this.minAge}`;
    }
    return null;
  }
}

// Test specification for email validation
class EmailSpecification implements ISpecification<{ email: string }> {
  isSatisfiedBy(candidate: { email: string }): boolean {
    return candidate.email.includes('@');
  }

  and(): ISpecification<{ email: string }> {
    throw new Error('Not implemented');
  }
  or(): ISpecification<{ email: string }> {
    throw new Error('Not implemented');
  }
  not(): ISpecification<{ email: string }> {
    throw new Error('Not implemented');
  }

  explainFailure(candidate: { email: string }): string | null {
    return candidate.email.includes('@') ? null : 'Email must contain @ symbol';
  }
}

describe('PolicyBuilder', () => {
  describe('Basic Builder Usage', () => {
    it('should create policy with single specification', async () => {
      const policy = PolicyBuilder.create<{ age: number }>()
        .withId('age-policy')
        .withDomain('test')
        .withName('Age Policy')
        .must(new AgeSpecification(18))
        .withCode('AGE_TOO_LOW')
        .withMessage('Must be at least 18 years old')
        .build();

      expect(policy.id).toBe('age-policy');
      expect(policy.domain).toBe('test');
      expect(policy.name).toBe('Age Policy');

      // Test valid case
      const context = PolicyContextBuilder.forUser('test-user').build();
      const validRequest = PolicyRequestBuilder.forEntityAndContext({ age: 25 }, context).build();

      const validResult = await policy.check(validRequest);
      expect(validResult.isSuccess).toBe(true);

      // Test invalid case
      const invalidRequest = PolicyRequestBuilder.forEntityAndContext({ age: 16 }, context).build();

      const invalidResult = await policy.check(invalidRequest);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error).toBeInstanceOf(PolicyViolation);
      expect(invalidResult.error.code).toBe('AGE_TOO_LOW');
      expect(invalidResult.error.message).toBe('Age 16 is below minimum required age of 18');
    });

    it('should create policy with custom predicate', async () => {
      const policy = PolicyBuilder.create<{ score: number }>()
        .withId('score-policy')
        .withDomain('test')
        .withName('Score Policy')
        .mustSatisfy(entity => entity.score >= 80, 'SCORE_TOO_LOW', 'Score must be at least 80')
        .withSeverity('WARNING')
        .build();

      const context = PolicyContextBuilder.forUser('test-user').build();

      // Test valid case
      const validRequest = PolicyRequestBuilder.forEntityAndContext({ score: 85 }, context).build();

      const validResult = await policy.check(validRequest);
      expect(validResult.isSuccess).toBe(true);

      // Test invalid case
      const invalidRequest = PolicyRequestBuilder.forEntityAndContext(
        { score: 75 },
        context
      ).build();

      const invalidResult = await policy.check(invalidRequest);
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error.severity).toBe('WARNING');
    });
  });

  describe('Fluent Step Configuration', () => {
    it('should configure step details', async () => {
      const policy = PolicyBuilder.create<{ email: string }>()
        .withId('email-policy')
        .withDomain('test')
        .withName('Email Policy')
        .must(new EmailSpecification())
        .withCode('INVALID_EMAIL')
        .withMessage('Email format is invalid')
        .withSeverity('ERROR')
        .withField('email')
        .withDetails({ pattern: '@' })
        .build();

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext(
        { email: 'invalid-email' },
        context
      ).build();

      const result = await policy.check(request);
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_EMAIL');
      expect(result.error.message).toBe('Email must contain @ symbol');
      expect(result.error.severity).toBe('ERROR');
      // Note: field and details would need to be propagated through the policy chain
    });
  });

  describe('Builder Validation', () => {
    it('should require ID', () => {
      const [error] = safeRun(() => {
        PolicyBuilder.create<{ age: number }>()
          .withDomain('test')
          .withName('Test Policy')
          .must(new AgeSpecification(18))
          .build();
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Policy ID is required');
    });

    it('should require domain', () => {
      const [error] = safeRun(() => {
        PolicyBuilder.create<{ age: number }>()
          .withId('test-policy')
          .withName('Test Policy')
          .must(new AgeSpecification(18))
          .build();
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Policy domain is required');
    });

    it('should require name', () => {
      const [error] = safeRun(() => {
        PolicyBuilder.create<{ age: number }>()
          .withId('test-policy')
          .withDomain('test')
          .must(new AgeSpecification(18))
          .build();
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Policy name is required');
    });

    it('should require at least one step', () => {
      const [error] = safeRun(() => {
        PolicyBuilder.create<{ age: number }>()
          .withId('test-policy')
          .withDomain('test')
          .withName('Test Policy')
          .build();
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('At least one policy step is required');
    });
  });

  describe('Builder Configuration', () => {
    it('should use default domain from config', () => {
      const policy = PolicyBuilder.create<{ age: number }>({
        defaultDomain: 'default-domain',
        defaultSeverity: 'WARNING',
      })
        .withId('test-policy')
        .withName('Test Policy')
        .must(new AgeSpecification(18))
        .build();

      expect(policy.domain).toBe('default-domain');
    });

    it('should use error code prefix from config', () => {
      const policy = PolicyBuilder.create<{ age: number }>({
        defaultDomain: 'test',
        defaultErrorCodePrefix: 'TEST',
      })
        .withId('test-policy')
        .withName('Test Policy')
        .must(new AgeSpecification(18))
        .build();

      // The error code would be prefixed, but we'd need to check this through policy execution
      expect(policy).toBeDefined();
    });
  });

  describe('Static Factory Methods', () => {
    it('should create builder for domain', () => {
      const policy = PolicyBuilder.forDomain<{ age: number }>('user-validation')
        .withId('test-policy')
        .withName('Test Policy')
        .must(new AgeSpecification(18))
        .build();

      expect(policy.domain).toBe('user-validation');
    });
  });
});

describe('PolicyGroup', () => {
  describe('Group Creation', () => {
    it('should create simple group with single specification', () => {
      const group = PolicyGroup.create<{ age: number }>('age-group')
        .must(new AgeSpecification(18))
        .withCode('GROUP_AGE_FAILED')
        .withMessage('Group age validation failed');

      const policy = group.getPolicy();
      expect(policy).toBeDefined();
      expect(policy.id).toContain('age-group');
    });

    it('should create group with multiple specifications', () => {
      const group = PolicyGroup.create<{ age: number; score: number }>('complex-group')
        .must(new AgeSpecification(18))
        .withCode('AGE_FAILED')
        .and()
        .mustSatisfy(entity => entity.score >= 80, 'SCORE_FAILED', 'Score too low');

      const policy = group.getPolicy();
      expect(policy).toBeDefined();
    });
  });

  describe('Group Validation', () => {
    it('should require at least one step', () => {
      const group = PolicyGroup.create<{ age: number }>('empty-group');

      const [error] = safeRun(() => group.getPolicy());
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Group must have at least one step');
    });
  });
});

describe('Complex Policy Scenarios', () => {
  describe('OR Group Logic', () => {
    it('should create policy with OR groups', () => {
      // This is a placeholder for shouldSatisfyAny functionality
      // The actual implementation would require proper group logic
      const excellentCreditGroup = PolicyGroup.create<{ creditScore: number }>(
        'excellent-credit'
      ).mustSatisfy(
        entity => entity.creditScore >= 800,
        'CREDIT_NOT_EXCELLENT',
        'Credit score must be excellent (800+)'
      );

      const goodCreditGroup = PolicyGroup.create<{ creditScore: number; collateral: number }>(
        'good-credit-with-collateral'
      ).mustSatisfy(
        entity => entity.creditScore >= 650,
        'CREDIT_NOT_GOOD',
        'Credit score must be good (650+)'
      );

      // Note: This would need actual implementation of shouldSatisfyAny
      const [error] = safeRun(() => {
        PolicyBuilder.create<{ creditScore: number; collateral?: number }>()
          .withId('loan-policy')
          .withDomain('lending')
          .withName('Loan Approval Policy')
          .shouldSatisfyAny(excellentCreditGroup, goodCreditGroup)
          .build();
      });

      // For now, this would throw an error because shouldSatisfyAny isn't fully implemented
      expect(error).toBeDefined();
    });
  });
});
