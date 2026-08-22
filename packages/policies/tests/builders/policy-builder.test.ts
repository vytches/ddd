import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';
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

// Test async specification for age validation
class AsyncAgeSpecification implements IAsyncSpecification<{ age: number }> {
  constructor(private minAge: number) {}

  async isSatisfiedByAsync(candidate: { age: number }): Promise<boolean> {
    return candidate.age >= this.minAge;
  }

  and(): IAsyncSpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }
  or(): IAsyncSpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }
  not(): IAsyncSpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }
}

// Test async specification for email validation
class AsyncEmailSpecification implements IAsyncSpecification<{ email: string }> {
  async isSatisfiedByAsync(candidate: { email: string }): Promise<boolean> {
    return candidate.email.includes('@');
  }

  and(): IAsyncSpecification<{ email: string }> {
    throw new Error('Not implemented for test');
  }
  or(): IAsyncSpecification<{ email: string }> {
    throw new Error('Not implemented for test');
  }
  not(): IAsyncSpecification<{ email: string }> {
    throw new Error('Not implemented for test');
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

    it('should create single-step policy with async specification (mustAsync)', async () => {
      const policy = PolicyBuilder.create<{ age: number }>()
        .withId('async-age-policy')
        .withDomain('test')
        .withName('Async Age Policy')
        .mustAsync(new AsyncAgeSpecification(18))
        .build();

      const context = PolicyContextBuilder.forUser('test-user').build();

      const validResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 25 }, context).build()
      );
      expect(validResult.isSuccess).toBe(true);

      const invalidResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 16 }, context).build()
      );
      expect(invalidResult.isFailure).toBe(true);
      expect(invalidResult.error).toBeInstanceOf(PolicyViolation);
      expect(invalidResult.error.code).toBe('ASYNC_SPECIFICATION_FAILED');
      expect(invalidResult.error.policyId).toBe('async-age-policy');
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

    it('should AND-combine specification and async-specification group steps with real check() results', async () => {
      const group = PolicyGroup.create<{ age: number; email: string }>('signup-group')
        .must(new AgeSpecification(18))
        .withCode('GROUP_AGE_TOO_LOW')
        .mustAsync(new AsyncEmailSpecification())
        .withCode('GROUP_BAD_EMAIL');

      const policy = group.getPolicy();
      const context = PolicyContextBuilder.forUser('test-user').build();

      const passingResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 25, email: 'a@b.com' }, context).build()
      );
      expect(passingResult.isSuccess).toBe(true);

      const failingAgeResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 16, email: 'a@b.com' }, context).build()
      );
      expect(failingAgeResult.isFailure).toBe(true);
      expect(failingAgeResult.error).toBeInstanceOf(PolicyViolation);
      expect(failingAgeResult.error.code).toBe('GROUP_AGE_TOO_LOW');

      const failingEmailResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 25, email: 'bad-email' }, context).build()
      );
      expect(failingEmailResult.isFailure).toBe(true);
      expect(failingEmailResult.error.code).toBe('GROUP_BAD_EMAIL');
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

describe('BuiltCompositePolicy (multi-step builder.build())', () => {
  it('should AND-combine specification and async-specification steps without throwing', async () => {
    const [error, policy] = safeRun(() =>
      PolicyBuilder.create<{ age: number; email: string }>()
        .withId('signup-policy')
        .withDomain('test')
        .withName('Signup Policy')
        .must(new AgeSpecification(18))
        .withCode('AGE_TOO_LOW')
        .and()
        .mustAsync(new AsyncEmailSpecification())
        .withCode('BAD_EMAIL')
        .build()
    );

    expect(error).toBeUndefined();
    expect(policy).toBeDefined();

    const context = PolicyContextBuilder.forUser('test-user').build();

    const passingResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ age: 25, email: 'a@b.com' }, context).build()
    );
    expect(passingResult.isSuccess).toBe(true);

    // First required step (specification) fails -> short-circuits before the async step.
    const failingAgeResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ age: 16, email: 'a@b.com' }, context).build()
    );
    expect(failingAgeResult.isFailure).toBe(true);
    expect(failingAgeResult.error.code).toBe('AGE_TOO_LOW');
    expect(failingAgeResult.error.policyId).toBe('signup-policy_step_0');

    const failingEmailResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ age: 25, email: 'bad-email' }, context).build()
    );
    expect(failingEmailResult.isFailure).toBe(true);
    expect(failingEmailResult.error.code).toBe('BAD_EMAIL');
    expect(failingEmailResult.error.policyId).toBe('signup-policy_step_1');
  });

  it('should AND-combine async-predicate and rules steps without throwing', async () => {
    const [error, policy] = safeRun(() =>
      PolicyBuilder.create<{ balance: number; verified: boolean }>()
        .withId('withdrawal-policy')
        .withDomain('test')
        .withName('Withdrawal Policy')
        .mustSatisfyAsync(
          async entity => entity.verified,
          'NOT_VERIFIED',
          'Account must be verified'
        )
        .and()
        .mustSatisfyRules(
          entity => entity.balance >= 100,
          'INSUFFICIENT_BALANCE',
          'Balance too low'
        )
        .build()
    );

    expect(error).toBeUndefined();
    expect(policy).toBeDefined();

    const context = PolicyContextBuilder.forUser('test-user').build();

    const passingResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ balance: 200, verified: true }, context).build()
    );
    expect(passingResult.isSuccess).toBe(true);

    const failingVerificationResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ balance: 200, verified: false }, context).build()
    );
    expect(failingVerificationResult.isFailure).toBe(true);
    expect(failingVerificationResult.error.code).toBe('NOT_VERIFIED');

    const failingBalanceResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ balance: 50, verified: true }, context).build()
    );
    expect(failingBalanceResult.isFailure).toBe(true);
    expect(failingBalanceResult.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(failingBalanceResult.error.policyId).toBe('withdrawal-policy_step_1');
  });

  it('should AND-combine rules and specification steps without throwing', async () => {
    const [error, policy] = safeRun(() =>
      PolicyBuilder.create<{ age: number; score: number }>()
        .withId('rules-spec-policy')
        .withDomain('test')
        .withName('Rules+Spec Policy')
        .mustSatisfyRules(entity => entity.score >= 50, 'SCORE_TOO_LOW', 'Score too low')
        .and()
        .must(new AgeSpecification(18))
        .withCode('AGE_TOO_LOW')
        .build()
    );

    expect(error).toBeUndefined();
    expect(policy).toBeDefined();

    const context = PolicyContextBuilder.forUser('test-user').build();

    const passingResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ age: 25, score: 60 }, context).build()
    );
    expect(passingResult.isSuccess).toBe(true);

    const failingResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext({ age: 16, score: 60 }, context).build()
    );
    expect(failingResult.isFailure).toBe(true);
    expect(failingResult.error.code).toBe('AGE_TOO_LOW');
  });

  it('should not throw when shouldSatisfyAny is mixed with another step (bug-report failure mode)', async () => {
    const excellentCreditGroup = PolicyGroup.create<{
      creditScore: number;
      applicationComplete: boolean;
    }>('mixed-excellent-credit').mustSatisfy(
      entity => entity.creditScore >= 800,
      'CREDIT_NOT_EXCELLENT',
      'Credit score must be excellent (800+)'
    );

    const goodCreditGroup = PolicyGroup.create<{
      creditScore: number;
      applicationComplete: boolean;
    }>('mixed-good-credit').mustSatisfy(
      entity => entity.creditScore >= 650,
      'CREDIT_NOT_GOOD',
      'Credit score must be good (650+)'
    );

    // build() no longer throws when a group-or step shares a composite with another step.
    const [error, policy] = safeRun(() =>
      PolicyBuilder.create<{ creditScore: number; applicationComplete: boolean }>()
        .withId('mixed-loan-policy')
        .withDomain('lending')
        .withName('Mixed Loan Policy')
        .mustSatisfy(
          entity => entity.applicationComplete,
          'APPLICATION_INCOMPLETE',
          'Application must be complete'
        )
        .and()
        .shouldSatisfyAny(excellentCreditGroup, goodCreditGroup)
        .build()
    );

    expect(error).toBeUndefined();
    expect(policy).toBeDefined();

    const context = PolicyContextBuilder.forUser('test-user').build();

    // First required step (predicate) fails -> short-circuits before the group-or step.
    const incompleteResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext(
        { creditScore: 900, applicationComplete: false },
        context
      ).build()
    );
    expect(incompleteResult.isFailure).toBe(true);
    expect(incompleteResult.error.code).toBe('APPLICATION_INCOMPLETE');

    // Predicate passes, neither credit group passes -> GROUP_OR_FAILED from the group-or step.
    const noGroupResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext(
        { creditScore: 500, applicationComplete: true },
        context
      ).build()
    );
    expect(noGroupResult.isFailure).toBe(true);
    expect(noGroupResult.error.code).toBe('GROUP_OR_FAILED');
    expect(noGroupResult.error.details?.groupFailures).toHaveLength(2);

    // Predicate passes, one credit group passes -> success end-to-end.
    const successResult = await policy!.check(
      PolicyRequestBuilder.forEntityAndContext(
        { creditScore: 700, applicationComplete: true },
        context
      ).build()
    );
    expect(successResult.isSuccess).toBe(true);
  });

  describe('Regression: composite specification/predicate shape (post step-policy-factory refactor)', () => {
    it('locks stepId format, error codes and violation shape for specification+predicate composite steps', async () => {
      const policy = PolicyBuilder.create<{ age: number; score: number }>()
        .withId('regression-policy')
        .withDomain('regression-domain')
        .withName('Regression Policy')
        .must(new AgeSpecification(18))
        .withCode('AGE_TOO_LOW')
        .and()
        .mustSatisfy(entity => entity.score >= 50, 'SCORE_TOO_LOW', 'Score too low')
        .build();

      const context = PolicyContextBuilder.forUser('test-user').build();

      const failingAge = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 10, score: 60 }, context).build()
      );
      expect(failingAge.isFailure).toBe(true);
      expect(failingAge.error).toBeInstanceOf(PolicyViolation);
      expect(failingAge.error.code).toBe('AGE_TOO_LOW');
      expect(failingAge.error.severity).toBe('ERROR');
      expect(failingAge.error.policyId).toBe('regression-policy_step_0');
      expect(failingAge.error.domain).toBe('regression-domain');

      const failingScore = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 25, score: 10 }, context).build()
      );
      expect(failingScore.isFailure).toBe(true);
      expect(failingScore.error.code).toBe('SCORE_TOO_LOW');
      expect(failingScore.error.policyId).toBe('regression-policy_step_1');

      const passing = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ age: 25, score: 60 }, context).build()
      );
      expect(passing.isSuccess).toBe(true);
    });
  });
});

describe('Complex Policy Scenarios', () => {
  describe('OR Group Logic', () => {
    it('should create policy with OR groups', async () => {
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

      // build() no longer throws - shouldSatisfyAny is fully implemented
      const [error, policy] = safeRun(() => {
        return PolicyBuilder.create<{ creditScore: number; collateral?: number }>()
          .withId('loan-policy')
          .withDomain('lending')
          .withName('Loan Approval Policy')
          .shouldSatisfyAny(excellentCreditGroup, goodCreditGroup)
          .build();
      });

      expect(error).toBeUndefined();
      expect(policy).toBeDefined();

      const context = PolicyContextBuilder.forUser('test-user').build();

      // Neither group is satisfied -> single GROUP_OR_FAILED violation with
      // aggregated, flattened group-failure snapshots.
      const failingRequest = PolicyRequestBuilder.forEntityAndContext(
        { creditScore: 500 },
        context
      ).build();

      const failingResult = await policy!.check(failingRequest);
      expect(failingResult.isFailure).toBe(true);
      expect(failingResult.error).toBeInstanceOf(PolicyViolation);
      expect(failingResult.error.code).toBe('GROUP_OR_FAILED');
      expect(failingResult.error.details?.groupFailures).toEqual([
        {
          groupIndex: 0,
          code: 'CREDIT_NOT_EXCELLENT',
          message: 'Credit score must be excellent (800+)',
          severity: 'ERROR',
        },
        {
          groupIndex: 1,
          code: 'CREDIT_NOT_GOOD',
          message: 'Credit score must be good (650+)',
          severity: 'ERROR',
        },
      ]);

      // Second group is satisfied -> OR succeeds.
      const passingRequest = PolicyRequestBuilder.forEntityAndContext(
        { creditScore: 700 },
        context
      ).build();

      const passingResult = await policy!.check(passingRequest);
      expect(passingResult.isSuccess).toBe(true);
    });

    it('flattens groupFailures to plain snapshots - never embedding live Error/PolicyViolation instances', async () => {
      const groupA = PolicyGroup.create<{ x: number }>('shape-group-a').mustSatisfy(
        entity => entity.x > 100,
        'X_TOO_LOW_A',
        'X must exceed 100 (A)'
      );

      const groupB = PolicyGroup.create<{ x: number }>('shape-group-b').mustSatisfy(
        entity => entity.x > 200,
        'X_TOO_LOW_B',
        'X must exceed 200 (B)'
      );

      const policy = PolicyBuilder.create<{ x: number }>()
        .withId('shape-policy')
        .withDomain('test')
        .withName('Shape Policy')
        .shouldSatisfyAny(groupA, groupB)
        .build();

      const context = PolicyContextBuilder.forUser('test-user').build();
      const result = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ x: 0 }, context).build()
      );

      expect(result.isFailure).toBe(true);
      const groupFailures = result.error.details?.groupFailures as unknown[];

      expect(groupFailures).toHaveLength(2);

      for (const failure of groupFailures) {
        expect(failure).not.toBeInstanceOf(Error);
        expect(failure).not.toBeInstanceOf(PolicyViolation);
        expect(Object.keys(failure as object).sort()).toEqual(
          ['code', 'groupIndex', 'message', 'severity'].sort()
        );
      }

      expect(groupFailures).toEqual([
        {
          groupIndex: 0,
          code: 'X_TOO_LOW_A',
          message: 'X must exceed 100 (A)',
          severity: 'ERROR',
        },
        {
          groupIndex: 1,
          code: 'X_TOO_LOW_B',
          message: 'X must exceed 200 (B)',
          severity: 'ERROR',
        },
      ]);
    });

    it('supports chaining withCode()/withSeverity() on the IPolicyStepBuilder returned by shouldSatisfyAny()', async () => {
      const excellentCreditGroup = PolicyGroup.create<{ creditScore: number }>(
        'chain-excellent-credit'
      ).mustSatisfy(
        entity => entity.creditScore >= 800,
        'CREDIT_NOT_EXCELLENT',
        'Credit score must be excellent (800+)'
      );

      const goodCreditGroup = PolicyGroup.create<{ creditScore: number }>(
        'chain-good-credit'
      ).mustSatisfy(
        entity => entity.creditScore >= 650,
        'CREDIT_NOT_GOOD',
        'Credit score must be good (650+)'
      );

      const policy = PolicyBuilder.create<{ creditScore: number }>()
        .withId('chained-loan-policy')
        .withDomain('lending')
        .withName('Chained Loan Policy')
        .shouldSatisfyAny(excellentCreditGroup, goodCreditGroup)
        .withCode('CUSTOM_OR_CODE')
        .withSeverity('WARNING')
        .build();

      const context = PolicyContextBuilder.forUser('test-user').build();

      const failingResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ creditScore: 100 }, context).build()
      );
      expect(failingResult.isFailure).toBe(true);
      expect(failingResult.error.code).toBe('CUSTOM_OR_CODE');
      expect(failingResult.error.severity).toBe('WARNING');

      const passingResult = await policy.check(
        PolicyRequestBuilder.forEntityAndContext({ creditScore: 700 }, context).build()
      );
      expect(passingResult.isSuccess).toBe(true);
    });
  });
});
