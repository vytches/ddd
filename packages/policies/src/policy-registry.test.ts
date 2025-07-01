import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyRegistry, globalPolicyRegistry, LegacyPolicyRegistry } from './policy-registry';
import { BusinessPolicy } from './business-policy';
import type { IBusinessPolicy, PolicyRequest } from './business-policy-interface';
import type { PolicyDefinition, RegistryPolicyMetadata } from './policy-registry';

describe('PolicyRegistry', () => {
  let registry: PolicyRegistry;
  let mockPolicy: IBusinessPolicy<any>;
  let mockPolicy2: IBusinessPolicy<any>;

  beforeEach(() => {
    registry = new PolicyRegistry();

    mockPolicy = {
      id: 'test-policy',
      domain: 'test-domain',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    mockPolicy2 = {
      id: 'test-policy-2',
      domain: 'test-domain',
      version: '1.1.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };
  });

  describe('register', () => {
    it('should register a policy without metadata', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      expect(registry.hasPolicy('test-domain', 'test-policy')).toBe(true);
      expect(registry.hasDomain('test-domain')).toBe(true);
    });

    it('should register a policy with metadata', () => {
      const metadata: Partial<RegistryPolicyMetadata> = {
        description: 'Test policy description',
        tags: ['test', 'validation'],
        registeredBy: 'system',
      };

      registry.register('test-domain', 'test-policy', mockPolicy, metadata);

      const policies = registry.getPolicies('test-domain');
      const definition = policies['test-policy'];

      expect(definition).toBeDefined();
      expect(definition!.metadata.description).toBe('Test policy description');
      expect(definition!.metadata.tags).toEqual(['test', 'validation']);
      expect(definition!.metadata.registeredBy).toBe('system');
      expect(definition!.metadata.registeredAt).toBeInstanceOf(Date);
    });

    it('should throw error when registering duplicate policy without replacement', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      expect(() => {
        registry.register('test-domain', 'test-policy', mockPolicy2);
      }).toThrow('Policy "test-policy" already exists in domain "test-domain"');
    });

    it('should allow registering duplicate policy with replacedBy metadata', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      expect(() => {
        registry.register('test-domain', 'test-policy', mockPolicy2, {
          replacedBy: 'new-policy',
        });
      }).not.toThrow();
    });
  });

  describe('resolve', () => {
    it('should resolve existing policy', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      const resolved = registry.resolve('test-domain', 'test-policy');

      expect(resolved).toBe(mockPolicy);
    });

    it('should return undefined for non-existing domain', () => {
      const resolved = registry.resolve('non-existing', 'test-policy');

      expect(resolved).toBeUndefined();
    });

    it('should return undefined for non-existing policy', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      const resolved = registry.resolve('test-domain', 'non-existing');

      expect(resolved).toBeUndefined();
    });

    it('should resolve replacement for deprecated policy', () => {
      registry.register('test-domain', 'old-policy', mockPolicy, {
        deprecated: true,
        replacedBy: 'new-policy',
      });

      registry.register('test-domain', 'new-policy', mockPolicy2);

      const resolved = registry.resolve('test-domain', 'old-policy');

      expect(resolved).toBe(mockPolicy2);
    });
  });

  describe('getPolicy', () => {
    it('should return existing policy', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      const policy = registry.getPolicy('test-domain', 'test-policy');

      expect(policy).toBe(mockPolicy);
    });

    it('should throw error for non-existing policy', () => {
      expect(() => {
        registry.getPolicy('test-domain', 'non-existing');
      }).toThrow('Policy "non-existing" not found in domain "test-domain"');
    });
  });

  describe('unregister', () => {
    it('should unregister existing policy', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      const result = registry.unregister('test-domain', 'test-policy');

      expect(result).toBe(true);
      expect(registry.hasPolicy('test-domain', 'test-policy')).toBe(false);
    });

    it('should return false for non-existing policy', () => {
      const result = registry.unregister('test-domain', 'non-existing');

      expect(result).toBe(false);
    });

    it('should remove domain when no policies left', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);

      registry.unregister('test-domain', 'test-policy');

      expect(registry.hasDomain('test-domain')).toBe(false);
    });

    it('should keep domain when other policies exist', () => {
      registry.register('test-domain', 'test-policy', mockPolicy);
      registry.register('test-domain', 'test-policy-2', mockPolicy2);

      registry.unregister('test-domain', 'test-policy');

      expect(registry.hasDomain('test-domain')).toBe(true);
      expect(registry.hasPolicy('test-domain', 'test-policy-2')).toBe(true);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.register('domain1', 'policy1', mockPolicy);
      registry.register('domain2', 'policy2', mockPolicy2);
    });

    it('should clear all policies when no domain specified', () => {
      registry.clear();

      expect(registry.getDomains()).toHaveLength(0);
    });

    it('should clear specific domain only', () => {
      registry.clear('domain1');

      expect(registry.hasDomain('domain1')).toBe(false);
      expect(registry.hasDomain('domain2')).toBe(true);
    });
  });

  describe('getDomains', () => {
    it('should return empty array when no domains registered', () => {
      expect(registry.getDomains()).toHaveLength(0);
    });

    it('should return all registered domains', () => {
      registry.register('domain1', 'policy1', mockPolicy);
      registry.register('domain2', 'policy2', mockPolicy2);

      const domains = registry.getDomains();

      expect(domains).toHaveLength(2);
      expect(domains).toContain('domain1');
      expect(domains).toContain('domain2');
    });
  });

  describe('getPolicies', () => {
    it('should return policies for existing domain', () => {
      registry.register('test-domain', 'policy1', mockPolicy);
      registry.register('test-domain', 'policy2', mockPolicy2);

      const policies = registry.getPolicies('test-domain');

      expect(Object.keys(policies)).toHaveLength(2);
      expect(policies['policy1']?.policy).toBe(mockPolicy);
      expect(policies['policy2']?.policy).toBe(mockPolicy2);
    });

    it('should throw error for non-existing domain', () => {
      expect(() => {
        registry.getPolicies('non-existing');
      }).toThrow('Domain "non-existing" not found');
    });

    it('should return copy of policies object', () => {
      registry.register('test-domain', 'policy1', mockPolicy);

      const policies1 = registry.getPolicies('test-domain');
      const policies2 = registry.getPolicies('test-domain');

      expect(policies1).not.toBe(policies2);
      expect(policies1).toEqual(policies2);
    });
  });

  describe('listPolicies', () => {
    it('should return policy IDs for existing domain', () => {
      registry.register('test-domain', 'policy1', mockPolicy);
      registry.register('test-domain', 'policy2', mockPolicy2);

      const policyIds = registry.listPolicies('test-domain');

      expect(policyIds).toHaveLength(2);
      expect(policyIds).toContain('policy1');
      expect(policyIds).toContain('policy2');
    });

    it('should return empty array for non-existing domain', () => {
      const policyIds = registry.listPolicies('non-existing');

      expect(policyIds).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register('domain1', 'policy1', mockPolicy, {
        tags: ['validation', 'user'],
        description: 'User validation policy',
      });

      registry.register('domain1', 'policy2', mockPolicy2, {
        tags: ['validation', 'admin'],
        description: 'Admin validation policy',
        deprecated: true,
      });

      registry.register('domain2', 'policy3', mockPolicy, {
        tags: ['security'],
        description: 'Security policy',
      });
    });

    it('should return all policies when no filters', () => {
      const results = registry.search({});

      expect(results).toHaveLength(2); // Deprecated policy excluded by default
    });

    it('should filter by domain', () => {
      const results = registry.search({ domain: 'domain1' });

      expect(results).toHaveLength(1); // Only non-deprecated policy from domain1
      expect(results[0]?.policy.id).toBe('test-policy'); // Should be policy1
    });

    it('should filter by policy ID', () => {
      const results = registry.search({ policyId: 'policy1' });

      expect(results).toHaveLength(1);
      expect(results[0]?.policy.id).toBe('test-policy');
    });

    it('should filter by tags', () => {
      const results = registry.search({ tags: ['validation'] });

      expect(results).toHaveLength(1); // Only non-deprecated policy with validation tag
      expect(results.every(r => r.metadata.tags?.includes('validation'))).toBe(true);
    });

    it('should exclude deprecated policies by default', () => {
      const results = registry.search({ includeDeprecated: false });

      expect(results).toHaveLength(2);
      expect(results.every(r => !r.metadata.deprecated)).toBe(true);
    });

    it('should include deprecated policies when requested', () => {
      const results = registry.search({ includeDeprecated: true });

      expect(results).toHaveLength(3);
    });

    it('should combine multiple filters', () => {
      const results = registry.search({
        domain: 'domain1',
        tags: ['validation'],
        includeDeprecated: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.policy.id).toBe('test-policy');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      registry.register('domain1', 'policy1', mockPolicy);
      registry.register('domain1', 'policy2', mockPolicy2, { deprecated: true });
      registry.register('domain2', 'policy3', mockPolicy);
    });

    it('should return correct statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalDomains).toBe(2);
      expect(stats.totalPolicies).toBe(3);
      expect(stats.deprecatedPolicies).toBe(1);
      expect(stats.domainCounts).toEqual({
        domain1: 2,
        domain2: 1,
      });
    });
  });

  describe('export', () => {
    it('should export registry data', () => {
      registry.register('test-domain', 'test-policy', mockPolicy, {
        description: 'Test policy',
        tags: ['test'],
      });

      const exported = registry.export();

      expect(exported.version).toBe('1.0.0');
      expect(exported.exportedAt).toBeInstanceOf(Date);
      expect(exported.data['test-domain']).toBeDefined();
      expect(exported.data['test-domain']['test-policy']).toBeDefined();

      const policyData = exported.data['test-domain']['test-policy'];
      expect(policyData.policyId).toBe('test-policy');
      expect(policyData.domain).toBe('test-domain');
      expect(policyData.version).toBe('1.0.0');
      expect(policyData.metadata.description).toBe('Test policy');
    });
  });
});

describe('globalPolicyRegistry', () => {
  it('should be a PolicyRegistry instance', () => {
    expect(globalPolicyRegistry).toBeInstanceOf(PolicyRegistry);
  });

  it('should be the same instance across imports', () => {
    expect(globalPolicyRegistry).toBe(globalPolicyRegistry);
  });
});

describe('LegacyPolicyRegistry', () => {
  let mockPolicy: IBusinessPolicy<any>;

  beforeEach(() => {
    globalPolicyRegistry.clear();

    mockPolicy = {
      id: 'legacy-policy',
      domain: 'legacy-domain',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };
  });

  it('should provide legacy register method', () => {
    LegacyPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    expect(globalPolicyRegistry.hasPolicy('test-domain', 'test-policy')).toBe(true);
  });

  it('should provide legacy getPolicy method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    const policy = LegacyPolicyRegistry.getPolicy('test-domain', 'test-policy');

    expect(policy).toBe(mockPolicy);
  });

  it('should provide legacy unregister method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    const result = LegacyPolicyRegistry.unregister('test-domain', 'test-policy');

    expect(result).toBe(true);
    expect(globalPolicyRegistry.hasPolicy('test-domain', 'test-policy')).toBe(false);
  });

  it('should provide legacy clear method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    LegacyPolicyRegistry.clear();

    expect(globalPolicyRegistry.getDomains()).toHaveLength(0);
  });

  it('should provide legacy getDomains method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    const domains = LegacyPolicyRegistry.getDomains();

    expect(domains).toContain('test-domain');
  });

  it('should provide legacy listPolicies method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    const policies = LegacyPolicyRegistry.listPolicies('test-domain');

    expect(policies).toContain('test-policy');
  });

  it('should provide legacy hasDomain method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    expect(LegacyPolicyRegistry.hasDomain('test-domain')).toBe(true);
    expect(LegacyPolicyRegistry.hasDomain('non-existing')).toBe(false);
  });

  it('should provide legacy hasPolicy method', () => {
    globalPolicyRegistry.register('test-domain', 'test-policy', mockPolicy);

    expect(LegacyPolicyRegistry.hasPolicy('test-domain', 'test-policy')).toBe(true);
    expect(LegacyPolicyRegistry.hasPolicy('test-domain', 'non-existing')).toBe(false);
  });
});
