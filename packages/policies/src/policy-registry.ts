/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IBusinessPolicy, PolicyMetadata } from './business-policy-interface';

/**
 * Policy definition for registry storage
 */
export interface PolicyDefinition<T = any> {
  policy: IBusinessPolicy<T>;
  metadata: RegistryPolicyMetadata;
}

/**
 * Registry-specific metadata (extends PolicyMetadata)
 */
export interface RegistryPolicyMetadata extends PolicyMetadata {
  registeredAt: Date;
  registeredBy?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  replacedBy?: string;
}

/**
 * Query interface for finding policies
 */
export interface PolicyQuery {
  domain?: string;
  policyId?: string;
  tags?: string[];
  includeDeprecated?: boolean;
}

/**
 * Registry interface for dependency injection
 */
export interface IPolicyRegistry {
  register<T>(
    domain: string,
    policyId: string,
    policy: IBusinessPolicy<T>,
    metadata?: Partial<RegistryPolicyMetadata>
  ): void;

  resolve<T>(domain: string, policyId: string): IBusinessPolicy<T> | undefined;

  unregister(domain: string, policyId: string): boolean;

  clear(domain?: string): void;

  getDomains(): string[];

  getPolicies(domain: string): Record<string, PolicyDefinition>;

  search(query: PolicyQuery): PolicyDefinition[];
}

/**
 * Instance-based policy registry implementation
 * Designed for dependency injection and multiple registry contexts
 */
export class PolicyRegistry implements IPolicyRegistry {
  private readonly policies = new Map<string, Record<string, PolicyDefinition>>();

  /**
   * Register a policy with optional metadata
   */
  register<T>(
    domain: string,
    policyId: string,
    policy: IBusinessPolicy<T>,
    metadata: Partial<RegistryPolicyMetadata> = {}
  ): void {
    if (!this.policies.has(domain)) {
      this.policies.set(domain, {});
    }

    const domainPolicies = this.policies.get(domain)!;

    // Check if policy already exists
    if (domainPolicies[policyId] && !metadata.replacedBy) {
      throw new Error(
        `Policy "${policyId}" already exists in domain "${domain}". Use metadata.replacedBy to replace.`
      );
    }

    const policyDefinition: PolicyDefinition<T> = {
      policy: policy as IBusinessPolicy<any>,
      metadata: {
        registeredAt: new Date(),
        ...(metadata.registeredBy !== undefined && { registeredBy: metadata.registeredBy }),
        ...(metadata.description !== undefined && { description: metadata.description }),
        tags: metadata.tags || [],
        deprecated: metadata.deprecated || false,
        ...(metadata.replacedBy !== undefined && { replacedBy: metadata.replacedBy }),
      },
    };

    domainPolicies[policyId] = policyDefinition;
  }

  /**
   * Resolve a policy by domain and ID
   */
  resolve<T>(domain: string, policyId: string): IBusinessPolicy<T> | undefined {
    const domainPolicies = this.policies.get(domain);
    if (!domainPolicies) {
      return undefined;
    }

    const definition = domainPolicies[policyId];
    if (!definition) {
      return undefined;
    }

    // Check if policy is deprecated and has replacement
    if (definition.metadata.deprecated && definition.metadata.replacedBy) {
      return this.resolve<T>(domain, definition.metadata.replacedBy);
    }

    return definition.policy as IBusinessPolicy<T>;
  }

  /**
   * Get a policy (throws if not found - for backwards compatibility)
   */
  getPolicy<T>(domain: string, policyId: string): IBusinessPolicy<T> {
    const policy = this.resolve<T>(domain, policyId);
    if (!policy) {
      throw new Error(`Policy "${policyId}" not found in domain "${domain}"`);
    }
    return policy;
  }

  /**
   * Unregister a specific policy
   */
  unregister(domain: string, policyId: string): boolean {
    const domainPolicies = this.policies.get(domain);
    if (!domainPolicies || !domainPolicies[policyId]) {
      return false;
    }

    delete domainPolicies[policyId];

    // Remove domain if no policies left
    if (Object.keys(domainPolicies).length === 0) {
      this.policies.delete(domain);
    }

    return true;
  }

  /**
   * Clear policies (all domains or specific domain)
   */
  clear(domain?: string): void {
    if (domain) {
      this.policies.delete(domain);
    } else {
      this.policies.clear();
    }
  }

  /**
   * Get all registered domains
   */
  getDomains(): string[] {
    return Array.from(this.policies.keys());
  }

  /**
   * Get all policies for a domain
   */
  getPolicies(domain: string): Record<string, PolicyDefinition> {
    const domainPolicies = this.policies.get(domain);
    if (!domainPolicies) {
      throw new Error(`Domain "${domain}" not found`);
    }
    return { ...domainPolicies };
  }

  /**
   * Get policy IDs for a domain
   */
  listPolicies(domain: string): string[] {
    const domainPolicies = this.policies.get(domain);
    if (!domainPolicies) {
      return [];
    }
    return Object.keys(domainPolicies);
  }

  /**
   * Check if domain exists
   */
  hasDomain(domain: string): boolean {
    return this.policies.has(domain);
  }

  /**
   * Check if policy exists
   */
  hasPolicy(domain: string, policyId: string): boolean {
    const domainPolicies = this.policies.get(domain);
    return domainPolicies ? policyId in domainPolicies : false;
  }

  /**
   * Search policies by query
   */
  search(query: PolicyQuery): PolicyDefinition[] {
    const results: PolicyDefinition[] = [];

    for (const [domain, policies] of Array.from(this.policies.entries())) {
      // Filter by domain if specified
      if (query.domain && domain !== query.domain) {
        continue;
      }

      for (const [policyId, definition] of Object.entries(policies)) {
        // Filter by policy ID if specified
        if (query.policyId && policyId !== query.policyId) {
          continue;
        }

        // Filter by deprecated status
        if (!query.includeDeprecated && definition.metadata.deprecated) {
          continue;
        }

        // Filter by tags if specified
        if (query.tags && query.tags.length > 0) {
          const hasMatchingTag = query.tags.some(tag => definition.metadata.tags?.includes(tag));
          if (!hasMatchingTag) {
            continue;
          }
        }

        results.push(definition);
      }
    }

    return results;
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    let totalPolicies = 0;
    let deprecatedPolicies = 0;
    const domainCounts: Record<string, number> = {};

    for (const [domain, policies] of Array.from(this.policies.entries())) {
      const count = Object.keys(policies).length;
      domainCounts[domain] = count;
      totalPolicies += count;

      for (const definition of Object.values(policies)) {
        if (definition.metadata.deprecated) {
          deprecatedPolicies++;
        }
      }
    }

    return {
      totalDomains: this.policies.size,
      totalPolicies,
      deprecatedPolicies,
      domainCounts,
    };
  }

  /**
   * Export all policies to JSON
   */
  export(): RegistryExport {
    const data: Record<string, Record<string, any>> = {};

    for (const [domain, policies] of Array.from(this.policies.entries())) {
      data[domain] = {};
      for (const [policyId, definition] of Object.entries(policies)) {
        data[domain][policyId] = {
          policyId: definition.policy.id,
          domain: definition.policy.domain,
          version: definition.policy.version,
          metadata: definition.metadata,
        };
      }
    }

    return {
      exportedAt: new Date(),
      version: '1.0.0',
      data,
    };
  }
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalDomains: number;
  totalPolicies: number;
  deprecatedPolicies: number;
  domainCounts: Record<string, number>;
}

/**
 * Registry export format
 */
export interface RegistryExport {
  exportedAt: Date;
  version: string;
  data: Record<string, Record<string, any>>;
}

/**
 * Global registry instance for backwards compatibility
 * @deprecated Use dependency injection with IPolicyRegistry interface
 */
export const globalPolicyRegistry = new PolicyRegistry();

/**
 * Legacy static methods for backwards compatibility
 * @deprecated Use instance methods instead
 */
export const LegacyPolicyRegistry = {
  register: globalPolicyRegistry.register.bind(globalPolicyRegistry),
  getPolicy: globalPolicyRegistry.getPolicy.bind(globalPolicyRegistry),
  unregister: globalPolicyRegistry.unregister.bind(globalPolicyRegistry),
  clear: globalPolicyRegistry.clear.bind(globalPolicyRegistry),
  getDomains: globalPolicyRegistry.getDomains.bind(globalPolicyRegistry),
  listPolicies: globalPolicyRegistry.listPolicies.bind(globalPolicyRegistry),
  hasDomain: globalPolicyRegistry.hasDomain.bind(globalPolicyRegistry),
  hasPolicy: globalPolicyRegistry.hasPolicy.bind(globalPolicyRegistry),
};
