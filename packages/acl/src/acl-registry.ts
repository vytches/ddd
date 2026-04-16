import type { IACLAdapter, IEnhancedACLAdapter } from './acl.interfaces';
import { BaseACLRegistry, type ACLRegistrationMetadata } from './base-acl-registry';
import type { ContextACLRegistry } from './context-acl-registry';
import type { AdapterDefinition } from './adapter-definition';

export interface ImportOptions {
  overwriteConflicts?: boolean;
  validateAdapters?: boolean;
}

export interface ImportResult {
  imported: string[];
  skipped: string[];
  conflicts: Array<{ contextName: string; reason: string }>;
}

export class ACLRegistry extends BaseACLRegistry {
  protected getRegistryName(): string {
    return 'GlobalACLRegistry';
  }

  /**
   * Create a registry pre-populated from an array of adapter definitions.
   * Replaces manual register() calls with declarative configuration.
   *
   * @public
   * @stable
   * @since 0.24.0
   *
   * @example
   * ```typescript
   * const registry = ACLRegistry.fromDefinitions([
   *   defineACLAdapter({ context: 'payments', adapter: paymentAdapter }),
   *   defineACLAdapter({ context: 'shipping', adapter: shippingAdapter }),
   * ]);
   * ```
   */
  static fromDefinitions(definitions: ReadonlyArray<AdapterDefinition>): ACLRegistry {
    const registry = new ACLRegistry();
    for (const def of definitions) {
      const metadata: Partial<ACLRegistrationMetadata> = {
        source: 'direct' as const,
        version: def.version ?? '1.0.0',
      };
      if (def.description !== undefined) {
        metadata.description = def.description;
      }
      registry.register(def.context, def.adapter, metadata);
    }
    return registry;
  }

  importFromContext(
    contextRegistry: ContextACLRegistry,
    options: ImportOptions = {}
  ): ImportResult {
    const result: ImportResult = { imported: [], skipped: [], conflicts: [] };
    const sourceAdapters = contextRegistry.exportAdapters();

    for (const [contextName, adapter] of sourceAdapters) {
      if (this.hasContext(contextName)) {
        if (options.overwriteConflicts) {
          this.register(contextName, adapter, { source: 'import' });
          result.imported.push(contextName);
        } else {
          result.conflicts.push({ contextName, reason: 'Already registered' });
          result.skipped.push(contextName);
        }
      } else {
        this.register(contextName, adapter, { source: 'import' });
        result.imported.push(contextName);
      }
    }

    return result;
  }

  registerDirect<TDomain, TExternal>(
    contextName: string,
    adapter: IACLAdapter<TDomain, TExternal>,
    description?: string
  ): this {
    const metadata: Partial<ACLRegistrationMetadata> = {
      source: 'direct' as const,
      version: '1.0.0',
    };
    if (description !== undefined) {
      metadata.description = description;
    }
    return this.register(contextName, adapter, metadata);
  }

  registerEnhanced<TDomain, TExternal>(
    contextName: string,
    adapter: IEnhancedACLAdapter<TDomain, TExternal>,
    description?: string
  ): this {
    const metadata: Partial<ACLRegistrationMetadata> = {
      source: 'enhanced' as const,
      version: '1.0.0',
    };
    if (description !== undefined) {
      metadata.description = description;
    }
    return this.register(contextName, adapter, metadata);
  }
}
