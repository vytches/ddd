import type {
  IBusinessPolicy,
  PolicyDefinition,
} from '../core/interfaces/business-policy.interface';
import type { IPolicyRegistry, PolicyQuery } from '../core/interfaces/policy-registry.interface';

/**
 * @llm-summary PolicyRegistry class for policy registry operations
 * @llm-domain Pattern
 * @llm-complexity Simple
 *
 * @description
 * PolicyRegistry class implementing domain pattern implementation for policy registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyRegistry();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyRegistry());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyRegistry implements IPolicyRegistry {
  private readonly policies = new Map<string, PolicyDefinition<unknown>>();

  /**
   * Generate a unique key for a policy
   */
  private getKey(domain: string, policyId: string): string {
    return `${domain}:${policyId}`;
  }

  /**
   * Register a policy definition
   */
  public register<T>(definition: PolicyDefinition<T>): void {
    const key = this.getKey(definition.domain, definition.id);

    if (this.policies.has(key)) {
      throw new Error(
        `Policy '${definition.id}' already exists in domain '${definition.domain}'. ` +
          'Use unregister() first or choose a different ID.'
      );
    }

    // Validate the definition
    this.validateDefinition(definition);

    this.policies.set(key, definition);
  }

  /**
   * Resolve a policy by query
   */
  public resolve<T>(query: PolicyQuery): IBusinessPolicy<T> {
    const policy = this.tryResolve<T>(query);

    if (!policy) {
      throw new Error(`Policy '${query.policyId}' not found in domain '${query.domain}'`);
    }

    return policy;
  }

  /**
   * Try to resolve a policy by query
   */
  public tryResolve<T>(query: PolicyQuery): IBusinessPolicy<T> | null {
    const key = this.getKey(query.domain, query.policyId);
    const definition = this.policies.get(key);

    if (!definition) {
      return null;
    }

    // Check version constraint if specified
    if (query.version && definition.version !== query.version) {
      return null;
    }

    // Check tags constraint if specified
    if (query.tags && query.tags.length > 0) {
      const definitionTags = definition.tags || [];
      const hasAllTags = query.tags.every(tag => definitionTags.includes(tag));
      if (!hasAllTags) {
        return null;
      }
    }

    // Check if policy is active
    if (definition.isActive === false) {
      return null;
    }

    return definition.policy as IBusinessPolicy<T>;
  }

  /**
   * Unregister a policy
   */
  public unregister(domain: string, policyId: string): boolean {
    const key = this.getKey(domain, policyId);
    return this.policies.delete(key);
  }

  /**
   * Clear all registered policies
   */
  public clear(): void {
    this.policies.clear();
  }

  /**
   * Get all registered domains
   */
  public getDomains(): string[] {
    const domains = new Set<string>();

    for (const definition of this.policies.values()) {
      domains.add(definition.domain);
    }

    return Array.from(domains).sort();
  }

  /**
   * Get all policy IDs in a domain
   */
  public getPoliciesInDomain(domain: string): string[] {
    const policyIds: string[] = [];

    for (const definition of this.policies.values()) {
      if (definition.domain === domain) {
        policyIds.push(definition.id);
      }
    }

    return policyIds.sort();
  }

  /**
   * Get policy definition by domain and ID
   */
  public getDefinition<T>(domain: string, policyId: string): PolicyDefinition<T> | null {
    const key = this.getKey(domain, policyId);
    return (this.policies.get(key) as PolicyDefinition<T>) || null;
  }

  /**
   * Check if a policy exists
   */
  public exists(domain: string, policyId: string): boolean {
    const key = this.getKey(domain, policyId);
    return this.policies.has(key);
  }

  /**
   * Get total number of registered policies
   */
  public count(): number {
    return this.policies.size;
  }

  /**
   * Find policies by tags
   */
  public findByTags<T>(domain: string, tags: string[]): PolicyDefinition<T>[] {
    const matchingPolicies: PolicyDefinition<T>[] = [];

    for (const definition of this.policies.values()) {
      if (definition.domain !== domain) {
        continue;
      }

      const definitionTags = definition.tags || [];
      const hasAllTags = tags.every(tag => definitionTags.includes(tag));

      if (hasAllTags) {
        matchingPolicies.push(definition as PolicyDefinition<T>);
      }
    }

    // Sort by priority (higher first), then by ID
    return matchingPolicies.sort((a, b) => {
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }

      return a.id.localeCompare(b.id); // Then by ID alphabetically
    });
  }

  /**
   * Get policies by domain with optional filtering
   */
  public getPoliciesByDomain<T>(
    domain: string,
    options: {
      includeInactive?: boolean;
      tags?: string[];
      version?: string;
    } = {}
  ): PolicyDefinition<T>[] {
    const policies: PolicyDefinition<T>[] = [];

    for (const definition of this.policies.values()) {
      if (definition.domain !== domain) {
        continue;
      }

      // Filter by active status
      if (!options.includeInactive && definition.isActive === false) {
        continue;
      }

      // Filter by version
      if (options.version && definition.version !== options.version) {
        continue;
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        const definitionTags = definition.tags || [];
        const hasAllTags = options.tags.every(tag => definitionTags.includes(tag));
        if (!hasAllTags) {
          continue;
        }
      }

      policies.push(definition as PolicyDefinition<T>);
    }

    // Sort by priority (higher first), then by ID
    return policies.sort((a, b) => {
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }

      return a.id.localeCompare(b.id); // Then by ID alphabetically
    });
  }

  /**
   * Update policy metadata (without changing the policy implementation)
   */
  public updateMetadata<T>(
    domain: string,
    policyId: string,
    updates: Partial<
      Pick<PolicyDefinition<T>, 'name' | 'description' | 'tags' | 'metadata' | 'priority'> & {
        isActive?: boolean;
      }
    >
  ): boolean {
    const key = this.getKey(domain, policyId);
    const definition = this.policies.get(key);

    if (!definition) {
      return false;
    }

    const updatedDefinition: PolicyDefinition<T> = {
      ...(definition as PolicyDefinition<T>),
      ...updates,
    };

    this.policies.set(key, updatedDefinition);
    return true;
  }

  /**
   * Get registry statistics
   */
  public getStatistics(): PolicyRegistryStatistics {
    const stats: PolicyRegistryStatistics = {
      totalPolicies: this.policies.size,
      totalDomains: this.getDomains().length,
      activePolicies: 0,
      inactivePolicies: 0,
      domainStats: new Map(),
    };

    for (const definition of this.policies.values()) {
      // Count active/inactive
      if (definition.isActive !== false) {
        stats.activePolicies++;
      } else {
        stats.inactivePolicies++;
      }

      // Count by domain
      const domainCount = stats.domainStats.get(definition.domain) || 0;
      stats.domainStats.set(definition.domain, domainCount + 1);
    }

    return stats;
  }

  /**
   * Validate a policy definition
   */
  private validateDefinition<T>(definition: PolicyDefinition<T>): void {
    if (!definition.id) {
      throw new Error('Policy ID is required');
    }

    if (!definition.domain) {
      throw new Error('Policy domain is required');
    }

    if (!definition.name) {
      throw new Error('Policy name is required');
    }

    if (!definition.policy) {
      throw new Error('Policy implementation is required');
    }

    // Validate ID format (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(definition.id)) {
      throw new Error(
        'Policy ID must contain only alphanumeric characters, dashes, and underscores'
      );
    }

    // Validate domain format
    if (!/^[a-zA-Z0-9_-]+$/.test(definition.domain)) {
      throw new Error(
        'Policy domain must contain only alphanumeric characters, dashes, and underscores'
      );
    }

    // Validate version format if provided
    if (definition.version && !/^\d+\.\d+\.\d+$/.test(definition.version)) {
      throw new Error('Policy version must follow semantic versioning format (e.g., "1.0.0")');
    }

    // Validate priority if provided
    if (
      definition.priority !== undefined &&
      (!Number.isInteger(definition.priority) || definition.priority < 0)
    ) {
      throw new Error('Policy priority must be a non-negative integer');
    }
  }
}

/**
 * @llm-summary Contract for policy registry statistics functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyRegistryStatistics interface implementing domain pattern implementation for policy registry statistics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyRegistryStatistics implements PolicyRegistryStatistics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyRegistryStatistics {
  totalPolicies: number;
  totalDomains: number;
  activePolicies: number;
  inactivePolicies: number;
  domainStats: Map<string, number>;
}
