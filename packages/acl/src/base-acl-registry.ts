import type { IACLAdapter } from './acl.interfaces';

/**
 * @llm-summary Contract for a c l registration metadata functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ACLRegistrationMetadata interface implementing integration layer component for a c l registration metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteACLRegistrationMetadata implements ACLRegistrationMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ACLRegistrationMetadata {
  contextName: string;
  registeredAt: Date;
  registeredBy: string;
  description?: string;
  version?: string;
  source?: 'direct' | 'module' | 'import' | 'versioned' | 'enhanced';
}

/**
 * @llm-summary BaseACLRegistry class for base a c l registry operations
 * @llm-domain Integration
 * @llm-complexity Simple
 *
 * @description
 * BaseACLRegistry class implementing integration layer component for base a c l registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseACLRegistry();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseACLRegistry());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseACLRegistry {
  protected adapters = new Map<string, IACLAdapter<unknown, unknown>>();
  protected metadata = new Map<string, ACLRegistrationMetadata>();

  register<TDomain, TExternal>(
    contextName: string,
    adapter: IACLAdapter<TDomain, TExternal>,
    metadata?: Partial<ACLRegistrationMetadata>
  ): this {
    this.adapters.set(contextName, adapter);
    this.metadata.set(contextName, {
      contextName,
      registeredAt: new Date(),
      registeredBy: this.getRegistryName(),
      ...metadata,
    });
    return this;
  }

  get<TDomain, TExternal>(contextName: string): IACLAdapter<TDomain, TExternal> | undefined {
    return this.adapters.get(contextName) as IACLAdapter<TDomain, TExternal> | undefined;
  }

  getRequired<TDomain, TExternal>(contextName: string): IACLAdapter<TDomain, TExternal> {
    const adapter = this.adapters.get(contextName);
    if (!adapter) {
      throw new Error(`ACL adapter not found for context: ${contextName}`);
    }
    return adapter as IACLAdapter<TDomain, TExternal>;
  }

  hasContext(contextName: string): boolean {
    return this.adapters.has(contextName);
  }

  getRegisteredContexts(): string[] {
    return Array.from(this.adapters.keys());
  }

  protected abstract getRegistryName(): string;
  public exportAdapters(): Map<string, IACLAdapter<unknown, unknown>> {
    return new Map(this.adapters);
  }
}
