import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { PolicyRegistry } from '../../src/registry';
import type { PolicyDefinition, PolicyQuery, IBusinessPolicy } from '../../src/core/interfaces';

describe('PolicyRegistry', () => {
  let registry: PolicyRegistry;
  let mockPolicy: IBusinessPolicy<{ name: string }>;

  beforeEach(() => {
    registry = new PolicyRegistry();

    // Create mock policy
    mockPolicy = {
      id: 'test-policy',
      domain: 'test',
      name: 'Test Policy',
      check: async () => ({ isSuccess: true, isFailure: false, value: { name: 'test' } }) as any,
      and: () => mockPolicy as any,
      or: () => mockPolicy as any,
      not: () => mockPolicy,
      when: () => ({}) as any,
    };
  });

  describe('Policy Registration', () => {
    it('should register a policy definition', () => {
      const definition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        description: 'A test policy',
        policy: mockPolicy,
        version: '1.0.0',
        isActive: true,
        tags: ['test', 'example'],
        priority: 10,
        metadata: { author: 'test-author' },
      };

      registry.register(definition);

      expect(registry.exists('test', 'test-policy')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should prevent duplicate policy registration', () => {
      const definition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
      };

      registry.register(definition);

      const [error] = safeRun(() => {
        registry.register(definition);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('already exists');
    });

    it('should validate policy definition on registration', () => {
      const invalidDefinition = {
        id: '',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
      } as PolicyDefinition<{ name: string }>;

      const [error] = safeRun(() => {
        registry.register(invalidDefinition);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Policy ID is required');
    });

    it('should validate policy ID format', () => {
      const invalidDefinition: PolicyDefinition<{ name: string }> = {
        id: 'invalid policy!',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
      };

      const [error] = safeRun(() => {
        registry.register(invalidDefinition);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('alphanumeric characters, dashes, and underscores');
    });

    it('should validate domain format', () => {
      const invalidDefinition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'invalid domain!',
        name: 'Test Policy',
        policy: mockPolicy,
      };

      const [error] = safeRun(() => {
        registry.register(invalidDefinition);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('alphanumeric characters, dashes, and underscores');
    });

    it('should validate version format', () => {
      const invalidDefinition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
        version: 'invalid-version',
      };

      const [error] = safeRun(() => {
        registry.register(invalidDefinition);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('semantic versioning format');
    });

    it('should validate priority format', () => {
      const invalidDefinition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
        priority: -1,
      };

      const [error] = safeRun(() => {
        registry.register(invalidDefinition);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('non-negative integer');
    });
  });

  describe('Policy Resolution', () => {
    beforeEach(() => {
      const definition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
        version: '1.0.0',
        isActive: true,
        tags: ['test', 'example'],
      };

      registry.register(definition);
    });

    it('should resolve policy by domain and ID', () => {
      const query: PolicyQuery = {
        domain: 'test',
        policyId: 'test-policy',
      };

      const policy = registry.resolve<{ name: string }>(query);
      expect(policy).toBe(mockPolicy);
    });

    it('should return null for non-existent policy', () => {
      const query: PolicyQuery = {
        domain: 'test',
        policyId: 'non-existent',
      };

      const policy = registry.tryResolve<{ name: string }>(query);
      expect(policy).toBeNull();
    });

    it('should throw error when resolving non-existent policy', () => {
      const query: PolicyQuery = {
        domain: 'test',
        policyId: 'non-existent',
      };

      const [error] = safeRun(() => {
        registry.resolve<{ name: string }>(query);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('not found');
    });

    it('should filter by version', () => {
      const query: PolicyQuery = {
        domain: 'test',
        policyId: 'test-policy',
        version: '2.0.0',
      };

      const policy = registry.tryResolve<{ name: string }>(query);
      expect(policy).toBeNull();

      const validQuery: PolicyQuery = {
        domain: 'test',
        policyId: 'test-policy',
        version: '1.0.0',
      };

      const validPolicy = registry.tryResolve<{ name: string }>(validQuery);
      expect(validPolicy).toBe(mockPolicy);
    });

    it('should filter by tags', () => {
      const query: PolicyQuery = {
        domain: 'test',
        policyId: 'test-policy',
        tags: ['production'],
      };

      const policy = registry.tryResolve<{ name: string }>(query);
      expect(policy).toBeNull();

      const validQuery: PolicyQuery = {
        domain: 'test',
        policyId: 'test-policy',
        tags: ['test'],
      };

      const validPolicy = registry.tryResolve<{ name: string }>(validQuery);
      expect(validPolicy).toBe(mockPolicy);
    });

    it('should respect active status', () => {
      // Register inactive policy
      const inactivePolicy = { ...mockPolicy, id: 'inactive-policy' };
      const inactiveDefinition: PolicyDefinition<{ name: string }> = {
        id: 'inactive-policy',
        domain: 'test',
        name: 'Inactive Policy',
        policy: inactivePolicy,
        isActive: false,
      };

      registry.register(inactiveDefinition);

      const query: PolicyQuery = {
        domain: 'test',
        policyId: 'inactive-policy',
      };

      const policy = registry.tryResolve<{ name: string }>(query);
      expect(policy).toBeNull();
    });
  });

  describe('Policy Management', () => {
    beforeEach(() => {
      const definition: PolicyDefinition<{ name: string }> = {
        id: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        policy: mockPolicy,
        version: '1.0.0',
        tags: ['test'],
        priority: 10,
        metadata: { author: 'test-author' },
      };

      registry.register(definition);
    });

    it('should unregister policy', () => {
      const result = registry.unregister('test', 'test-policy');
      expect(result).toBe(true);
      expect(registry.exists('test', 'test-policy')).toBe(false);
    });

    it('should return false when unregistering non-existent policy', () => {
      const result = registry.unregister('test', 'non-existent');
      expect(result).toBe(false);
    });

    it('should clear all policies', () => {
      expect(registry.count()).toBe(1);
      registry.clear();
      expect(registry.count()).toBe(0);
    });

    it('should get definition by domain and ID', () => {
      const definition = registry.getDefinition<{ name: string }>('test', 'test-policy');
      expect(definition).toBeDefined();
      expect(definition?.id).toBe('test-policy');
      expect(definition?.domain).toBe('test');
    });

    it('should update metadata', () => {
      const result = registry.updateMetadata('test', 'test-policy', {
        name: 'Updated Test Policy',
        tags: ['updated', 'test'],
        priority: 20,
        isActive: false,
      });

      expect(result).toBe(true);

      const definition = registry.getDefinition<{ name: string }>('test', 'test-policy');
      expect(definition?.name).toBe('Updated Test Policy');
      expect(definition?.tags).toEqual(['updated', 'test']);
      expect(definition?.priority).toBe(20);
      expect(definition?.isActive).toBe(false);
    });

    it('should return false when updating non-existent policy metadata', () => {
      const result = registry.updateMetadata('test', 'non-existent', {
        name: 'Updated',
      });

      expect(result).toBe(false);
    });
  });

  describe('Domain and Query Operations', () => {
    beforeEach(() => {
      // Register multiple policies across domains
      const policies = [
        {
          id: 'policy1',
          domain: 'domain-a',
          name: 'Policy 1',
          policy: mockPolicy,
          tags: ['security'],
          priority: 10,
        },
        {
          id: 'policy2',
          domain: 'domain-a',
          name: 'Policy 2',
          policy: mockPolicy,
          tags: ['validation'],
          priority: 20,
        },
        {
          id: 'policy3',
          domain: 'domain-b',
          name: 'Policy 3',
          policy: mockPolicy,
          tags: ['security', 'audit'],
          priority: 15,
        },
      ];

      policies.forEach(policy => registry.register(policy as PolicyDefinition<{ name: string }>));
    });

    it('should get all domains', () => {
      const domains = registry.getDomains();
      expect(domains).toEqual(['domain-a', 'domain-b']);
    });

    it('should get policies in domain', () => {
      const policyIds = registry.getPoliciesInDomain('domain-a');
      expect(policyIds).toEqual(['policy1', 'policy2']);
    });

    it('should find policies by tags', () => {
      const securityPolicies = registry.findByTags<{ name: string }>('domain-a', ['security']);
      expect(securityPolicies).toHaveLength(1);
      expect(securityPolicies[0]?.id).toBe('policy1');

      const auditPolicies = registry.findByTags<{ name: string }>('domain-b', [
        'security',
        'audit',
      ]);
      expect(auditPolicies).toHaveLength(1);
      expect(auditPolicies[0]?.id).toBe('policy3');
    });

    it('should get policies by domain with filters', () => {
      const allPolicies = registry.getPoliciesByDomain<{ name: string }>('domain-a');
      expect(allPolicies).toHaveLength(2);

      const securityPolicies = registry.getPoliciesByDomain<{ name: string }>('domain-a', {
        tags: ['security'],
      });
      expect(securityPolicies).toHaveLength(1);
      expect(securityPolicies[0]?.id).toBe('policy1');
    });

    it('should sort policies by priority', () => {
      const policies = registry.getPoliciesByDomain<{ name: string }>('domain-a');
      expect(policies[0]?.priority).toBe(20); // Higher priority first
      expect(policies[1]?.priority).toBe(10);
    });
  });

  describe('Registry Statistics', () => {
    beforeEach(() => {
      const policies = [
        {
          id: 'active1',
          domain: 'domain-a',
          name: 'Active Policy 1',
          policy: mockPolicy,
          isActive: true,
        },
        {
          id: 'active2',
          domain: 'domain-a',
          name: 'Active Policy 2',
          policy: mockPolicy,
          isActive: true,
        },
        {
          id: 'inactive1',
          domain: 'domain-b',
          name: 'Inactive Policy',
          policy: mockPolicy,
          isActive: false,
        },
      ];

      policies.forEach(policy => registry.register(policy as PolicyDefinition<{ name: string }>));
    });

    it('should provide registry statistics', () => {
      const stats = registry.getStatistics();

      expect(stats.totalPolicies).toBe(3);
      expect(stats.totalDomains).toBe(2);
      expect(stats.activePolicies).toBe(2);
      expect(stats.inactivePolicies).toBe(1);
      expect(stats.domainStats.get('domain-a')).toBe(2);
      expect(stats.domainStats.get('domain-b')).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty registry operations', () => {
      expect(registry.getDomains()).toEqual([]);
      expect(registry.getPoliciesInDomain('non-existent')).toEqual([]);
      expect(registry.findByTags('non-existent', ['tag'])).toEqual([]);
      expect(registry.count()).toBe(0);
    });

    it('should handle malformed queries gracefully', () => {
      const policy = registry.tryResolve<{ name: string }>({
        domain: '',
        policyId: '',
      });
      expect(policy).toBeNull();
    });
  });
});
