import type { IACLAdapter } from './acl.interfaces';

export interface ACLRegistrationMetadata {
  contextName: string;
  registeredAt: Date;
  registeredBy: string;
  description?: string;
  version?: string;
  source?: 'direct' | 'module' | 'import' | 'versioned' | 'enhanced';
}

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
