import type { IBusinessPolicy, PolicyDefinition } from '../interfaces/business-policy.interface';

/**
 * Policy definition for registry storage - re-exported from interfaces
 */
export type { PolicyDefinition };

// PolicyDefinition is already defined in interfaces, no need to redefine

/**
 * @llm-summary PolicyDefinitionBuilder class for policy definition builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyDefinitionBuilder class implementing domain pattern implementation for policy definition builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyDefinitionBuilder();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class PolicyDefinitionBuilder<T> {
  private id?: string;
  private domain?: string;
  private name?: string;
  private description?: string;
  private version?: string;
  private policy?: IBusinessPolicy<T>;
  private tags?: string[];
  private metadata?: Record<string, unknown>;
  private createdBy?: string;
  private isActive?: boolean;
  private priority?: number;

  /**
   * Set the policy ID
   */
  public withId(id: string): PolicyDefinitionBuilder<T> {
    this.id = id;
    return this;
  }

  /**
   * Set the domain
   */
  public withDomain(domain: string): PolicyDefinitionBuilder<T> {
    this.domain = domain;
    return this;
  }

  /**
   * Set the name
   */
  public withName(name: string): PolicyDefinitionBuilder<T> {
    this.name = name;
    return this;
  }

  /**
   * Set the description
   */
  public withDescription(description: string): PolicyDefinitionBuilder<T> {
    this.description = description;
    return this;
  }

  /**
   * Set the version
   */
  public withVersion(version: string): PolicyDefinitionBuilder<T> {
    this.version = version;
    return this;
  }

  /**
   * Set the policy implementation
   */
  public withPolicy(policy: IBusinessPolicy<T>): PolicyDefinitionBuilder<T> {
    this.policy = policy;
    return this;
  }

  /**
   * Set tags
   */
  public withTags(...tags: string[]): PolicyDefinitionBuilder<T> {
    this.tags = tags;
    return this;
  }

  /**
   * Set metadata
   */
  public withMetadata(metadata: Record<string, unknown>): PolicyDefinitionBuilder<T> {
    this.metadata = metadata;
    return this;
  }

  /**
   * Set who created this policy
   */
  public withCreatedBy(createdBy: string): PolicyDefinitionBuilder<T> {
    this.createdBy = createdBy;
    return this;
  }

  /**
   * Set whether policy is active
   */
  public withIsActive(isActive: boolean): PolicyDefinitionBuilder<T> {
    this.isActive = isActive;
    return this;
  }

  /**
   * Set execution priority
   */
  public withPriority(priority: number): PolicyDefinitionBuilder<T> {
    this.priority = priority;
    return this;
  }

  /**
   * Build the policy definition
   */
  public build(): PolicyDefinition<T> {
    if (!this.id) {
      throw new Error('Policy ID is required');
    }
    if (!this.domain) {
      throw new Error('Policy domain is required');
    }
    if (!this.name) {
      throw new Error('Policy name is required');
    }
    if (!this.policy) {
      throw new Error('Policy implementation is required');
    }

    const definition: PolicyDefinition<T> = {
      id: this.id,
      domain: this.domain,
      name: this.name,
      policy: this.policy,
      ...(this.description && { description: this.description }),
      version: this.version || '1.0.0',
      tags: this.tags || [],
      metadata: this.metadata || {},
      createdAt: new Date(),
      ...(this.createdBy && { createdBy: this.createdBy }),
      isActive: this.isActive !== false, // default to true
      priority: this.priority || 0,
    };

    return definition;
  }

  /**
   * Create a new builder
   */
  public static create<T>(): PolicyDefinitionBuilder<T> {
    return new PolicyDefinitionBuilder<T>();
  }
}
