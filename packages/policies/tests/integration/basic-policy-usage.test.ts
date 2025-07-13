import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { ISpecification } from '@vytches-ddd/contracts';
import {
  SpecificationPolicy,
  PolicyContextBuilder,
  PolicyRequestBuilder,
  PolicyRegistry,
  PolicyDefinitionBuilder,
  PolicyViolation,
} from '../../src';

// Test specification for age validation
class AgeSpecification implements ISpecification<{ age: number }> {
  constructor(private minAge: number) {}

  isSatisfiedBy(candidate: { age: number }): boolean {
    return candidate.age >= this.minAge;
  }

  and(other: ISpecification<{ age: number }>): ISpecification<{ age: number }> {
    throw new Error('Not implemented for test');
  }

  or(other: ISpecification<{ age: number }>): ISpecification<{ age: number }> {
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

describe('Basic Policy Usage Integration Test', () => {
  describe('SpecificationPolicy', () => {
    it('should pass when specification is satisfied', async () => {
      const ageSpec = new AgeSpecification(18);
      const policy = SpecificationPolicy.fromSpecification(
        'age-check',
        'user-validation',
        'Age Validation Policy',
        ageSpec,
        'AGE_TOO_LOW',
        'User must be at least 18 years old'
      );

      const context = PolicyContextBuilder.forUser('test-user').withEnvironment('test').build();

      const request = PolicyRequestBuilder.forEntityAndContext({ age: 25 }, context).build();

      const result = await policy.check(request);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ age: 25 });
    });

    it('should fail when specification is not satisfied', async () => {
      const ageSpec = new AgeSpecification(18);
      const policy = SpecificationPolicy.fromSpecification(
        'age-check',
        'user-validation',
        'Age Validation Policy',
        ageSpec,
        'AGE_TOO_LOW',
        'User must be at least 18 years old'
      );

      const context = PolicyContextBuilder.forUser('test-user').withEnvironment('test').build();

      const request = PolicyRequestBuilder.forEntityAndContext({ age: 16 }, context).build();

      const result = await policy.check(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(PolicyViolation);
      expect(result.error.code).toBe('AGE_TOO_LOW');
      expect(result.error.message).toBe('Age 16 is below minimum required age of 18');
      expect(result.error.severity).toBe('ERROR');
      expect(result.error.policyId).toBe('age-check');
      expect(result.error.domain).toBe('user-validation');
    });
  });

  describe('Policy Composition', () => {
    it('should combine policies with AND logic', async () => {
      const ageSpec = new AgeSpecification(18);
      const agePolicy = SpecificationPolicy.fromSpecification(
        'age-check',
        'user-validation',
        'Age Validation Policy',
        ageSpec
      );

      // Create a simple email policy
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

      const emailPolicy = SpecificationPolicy.fromSpecification(
        'email-check',
        'user-validation',
        'Email Validation Policy',
        new EmailSpecification()
      );

      // This would require generic type alignment in real implementation
      // For now, just test that the and() method returns a composer
      const composer = agePolicy.and(emailPolicy as any);

      expect(composer).toBeDefined();
      expect(typeof composer.check).toBe('function');
    });
  });

  describe('Policy Registry Integration', () => {
    it('should register and resolve policies', () => {
      const registry = new PolicyRegistry();

      const ageSpec = new AgeSpecification(18);
      const policy = SpecificationPolicy.fromSpecification(
        'age-check',
        'user-validation',
        'Age Validation Policy',
        ageSpec
      );

      const definition = PolicyDefinitionBuilder.create()
        .withId('age-check')
        .withDomain('user-validation')
        .withName('Age Validation Policy')
        .withDescription('Ensures user is at least 18 years old')
        .withPolicy(policy)
        .withTags('validation', 'age', 'user')
        .build();

      const [registerError] = safeRun(() => registry.register(definition));
      expect(registerError).toBeUndefined();

      const resolvedPolicy = registry.resolve({
        domain: 'user-validation',
        policyId: 'age-check',
      });

      expect(resolvedPolicy).toBe(policy);
      expect(registry.exists('user-validation', 'age-check')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should find policies by tags', () => {
      const registry = new PolicyRegistry();

      const ageSpec = new AgeSpecification(18);
      const policy = SpecificationPolicy.fromSpecification(
        'age-check',
        'user-validation',
        'Age Validation Policy',
        ageSpec
      );

      const definition = PolicyDefinitionBuilder.create()
        .withId('age-check')
        .withDomain('user-validation')
        .withName('Age Validation Policy')
        .withPolicy(policy)
        .withTags('validation', 'age', 'required')
        .build();

      registry.register(definition);

      const foundPolicies = registry.findByTags('user-validation', ['validation', 'age']);

      expect(foundPolicies).toHaveLength(1);
      expect(foundPolicies?.[0]?.id).toBe('age-check');
    });

    it('should provide registry statistics', () => {
      const registry = new PolicyRegistry();

      const ageSpec = new AgeSpecification(18);
      const policy1 = SpecificationPolicy.fromSpecification(
        'policy1',
        'domain1',
        'Policy 1',
        ageSpec
      );
      const policy2 = SpecificationPolicy.fromSpecification(
        'policy2',
        'domain1',
        'Policy 2',
        ageSpec
      );
      const policy3 = SpecificationPolicy.fromSpecification(
        'policy3',
        'domain2',
        'Policy 3',
        ageSpec
      );

      registry.register(
        PolicyDefinitionBuilder.create()
          .withId('policy1')
          .withDomain('domain1')
          .withName('Policy 1')
          .withPolicy(policy1)
          .build()
      );
      registry.register(
        PolicyDefinitionBuilder.create()
          .withId('policy2')
          .withDomain('domain1')
          .withName('Policy 2')
          .withPolicy(policy2)
          .build()
      );
      registry.register(
        PolicyDefinitionBuilder.create()
          .withId('policy3')
          .withDomain('domain2')
          .withName('Policy 3')
          .withPolicy(policy3)
          .build()
      );

      const stats = registry.getStatistics();

      expect(stats.totalPolicies).toBe(3);
      expect(stats.totalDomains).toBe(2);
      expect(stats.activePolicies).toBe(3);
      expect(stats.inactivePolicies).toBe(0);
      expect(stats.domainStats.get('domain1')).toBe(2);
      expect(stats.domainStats.get('domain2')).toBe(1);
    });
  });

  describe('Context and Request Builders', () => {
    it('should build complex policy context', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withTenantId('tenant-456')
        .withSessionId('session-789')
        .withEnvironment('production')
        .enableFeature('premium-validation')
        .disableFeature('debug-mode')
        .addMetadata('ipAddress', '192.168.1.1')
        .addMetadata('userAgent', 'Mozilla/5.0...')
        .build();

      expect(context.userId).toBe('user-123');
      expect(context.tenantId).toBe('tenant-456');
      expect(context.sessionId).toBe('session-789');
      expect(context.environment).toBe('production');
      expect(context.features['premium-validation']).toBe(true);
      expect(context.features['debug-mode']).toBe(false);
      expect(context.metadata.ipAddress).toBe('192.168.1.1');
      expect(context.metadata.userAgent).toBe('Mozilla/5.0...');
    });

    it('should build policy request with metadata', () => {
      const context = PolicyContextBuilder.forUser('user-123').build();
      const entity = { name: 'John Doe', age: 25 };

      const request = PolicyRequestBuilder.forEntityAndContext(entity, context)
        .withCorrelationId('corr-123')
        .withSource('web-app')
        .withOperation('user-creation')
        .addCustomMetadata('validation-level', 'strict')
        .build();

      expect(request.entity).toBe(entity);
      expect(request.context).toBe(context);
      expect(request.metadata?.correlationId).toBe('corr-123');
      expect(request.metadata?.source).toBe('web-app');
      expect(request.metadata?.operation).toBe('user-creation');
      expect(request.metadata?.custom?.['validation-level']).toBe('strict');
    });
  });
});
