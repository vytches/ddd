import type { IACLAdapter } from './acl.interfaces';
import { BaseACLRegistry, type ACLRegistrationMetadata } from './base-acl-registry';

export class ContextACLRegistry extends BaseACLRegistry {
  constructor(private readonly contextName: string) {
    super();
  }

  public getRegistryName(): string {
    return `ContextACLRegistry(${this.contextName})`;
  }

  registerLocal<TDomain, TExternal>(
    targetContextName: string,
    adapter: IACLAdapter<TDomain, TExternal>,
    description?: string,
  ): this {
    const metadata: Partial<ACLRegistrationMetadata> = { source: 'module' as const, version: '1.0.0' };
    if (description !== undefined) {
      metadata.description = description;
    }
    return this.register(targetContextName, adapter, metadata);
  }
}
