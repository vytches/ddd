import type { IBusinessPolicy, PolicyDefinition } from './business-policy.interface';

/**
 * @llm-summary Contract for policy query functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyQuery interface implementing domain pattern implementation for policy query operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyQuery implements PolicyQuery {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyQuery {
  /**
   * Domain to search in
   */
  readonly domain: string;

  /**
   * Policy ID to find
   */
  readonly policyId: string;

  /**
   * Optional version constraint
   */
  readonly version?: string;

  /**
   * Optional tags to filter by
   */
  readonly tags?: string[];
}

/**
 * @llm-summary Contract for policy registry functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyRegistry interface implementing domain pattern implementation for policy registry operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyRegistry implements IPolicyRegistry {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IPolicyRegistry {
  /**
   * Register a policy definition
   * @param definition The policy definition to register
   * @throws Error if policy with same domain/id already exists
   */
  register<T>(definition: PolicyDefinition<T>): void;

  /**
   * Resolve a policy by query
   * @param query Query parameters to find the policy
   * @returns The policy instance if found
   * @throws Error if policy not found
   */
  resolve<T>(query: PolicyQuery): IBusinessPolicy<T>;

  /**
   * Try to resolve a policy by query
   * @param query Query parameters to find the policy
   * @returns The policy instance if found, null otherwise
   */
  tryResolve<T>(query: PolicyQuery): IBusinessPolicy<T> | null;

  /**
   * Unregister a policy
   * @param domain The domain of the policy
   * @param policyId The ID of the policy
   * @returns true if policy was found and removed, false otherwise
   */
  unregister(domain: string, policyId: string): boolean;

  /**
   * Clear all registered policies
   */
  clear(): void;

  /**
   * Get all registered domains
   * @returns Array of domain names
   */
  getDomains(): string[];

  /**
   * Get all policy IDs in a domain
   * @param domain The domain to list policies for
   * @returns Array of policy IDs
   */
  getPoliciesInDomain(domain: string): string[];

  /**
   * Get policy definition by domain and ID
   * @param domain The domain of the policy
   * @param policyId The ID of the policy
   * @returns The policy definition if found, null otherwise
   */
  getDefinition<T>(domain: string, policyId: string): PolicyDefinition<T> | null;

  /**
   * Check if a policy exists
   * @param domain The domain of the policy
   * @param policyId The ID of the policy
   * @returns true if policy exists, false otherwise
   */
  exists(domain: string, policyId: string): boolean;

  /**
   * Get total number of registered policies
   * @returns Number of registered policies
   */
  count(): number;

  /**
   * Find policies by tags
   * @param domain The domain to search in
   * @param tags Tags to search for
   * @returns Array of policy definitions matching the tags
   */
  findByTags<T>(domain: string, tags: string[]): PolicyDefinition<T>[];
}

/**
 * @llm-summary Contract for unified registry functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * UnifiedRegistry interface implementing domain pattern implementation for unified registry operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteUnifiedRegistry implements IUnifiedRegistry {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IUnifiedRegistry {
  /**
   * Policy registry instance
   */
  readonly policies: IPolicyRegistry;

  // Future expansions:
  // readonly events: IEventRegistry;
  // readonly services: IServiceRegistry;
  // readonly handlers: IHandlerRegistry;
}
