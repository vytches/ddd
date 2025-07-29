import type { IACLAdapter, IEnhancedACLAdapter } from './acl.interfaces';
import { BaseACLRegistry, type ACLRegistrationMetadata } from './base-acl-registry';
import type { ContextACLRegistry } from './context-acl-registry';

/**
 * @llm-summary Contract for import options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ImportOptions interface implementing integration layer component for import options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretemportOptions implements ImportOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ImportOptions {
  overwriteConflicts?: boolean;
  validateAdapters?: boolean;
}

/**
 * @llm-summary Contract for import result functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ImportResult interface implementing integration layer component for import result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretemportResult implements ImportResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ImportResult {
  imported: string[];
  skipped: string[];
  conflicts: Array<{ contextName: string; reason: string }>;
}

/**
 * @llm-summary ACLRegistry class for a c l registry operations
 * @llm-domain Integration
 * @llm-complexity Simple
 *
 * @description
 * ACLRegistry class implementing integration layer component for a c l registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ACLRegistry();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ACLRegistry extends BaseACLRegistry {
  protected getRegistryName(): string {
    return 'GlobalACLRegistry';
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
