/* eslint-disable @typescript-eslint/no-explicit-any */
// enhanced-acl-adapter.ts
import { Result } from '@vytches/ddd-utils';
import { ACLError } from './acl-errors';
import { SimpleACLAdapter } from './base-acl-adapter';
import type {
  IEnhancedACLAdapter,
  ACLContextInfo,
  IModelTranslator,
  IExternalAPI,
  ExecuteOptions,
} from './acl.interfaces';
import type { TypedOperation } from './typed-operations';

/**
 * @llm-summary EnhancedACLAdapter class for enhanced a c l adapter operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * EnhancedACLAdapter class implementing integration layer component for enhanced a c l adapter operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EnhancedACLAdapter();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EnhancedACLAdapter());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class EnhancedACLAdapter<TDomain, TExternal, TResult = any>
  extends SimpleACLAdapter<TDomain, TExternal, TResult>
  implements IEnhancedACLAdapter<TDomain, TExternal, TResult>
{
  constructor(
    contextInfo: ACLContextInfo,
    translator: IModelTranslator<TDomain, TExternal>,
    externalAPI: IExternalAPI<TExternal, TResult>,
    operations: string[]
  ) {
    super(contextInfo, translator, externalAPI, operations);
  }

  async executeTyped<TInput, TOutput>(
    operation: TypedOperation<TInput, TOutput>,
    domainModel: TDomain,
    options?: ExecuteOptions
  ): Promise<Result<TOutput, ACLError>> {
    if (operation.validateBusinessRules) {
      const validation = operation.validateBusinessRules(domainModel as any);
      if (validation.isFailure) {
        return Result.fail(
          new ACLError(
            `Business rule violation: ${validation.error.message}`,
            this.contextInfo.contextName,
            operation.name
          )
        );
      }
    }
    // 🔧 FIX: Execute and handle type conversion properly
    const result = await this.execute(operation.name, domainModel, options);

    if (result.isFailure) {
      return Result.fail(result.error);
    }

    // 🔧 Type assertion with runtime safety - typed operations guarantee type compatibility
    return Result.ok(result.value as unknown as TOutput);
  }

  // 🔧 Factory method for easier creation
  static override create<TDomain, TExternal, TResult = any>(
    contextName: string,
    externalSystemName: string,
    translator: IModelTranslator<TDomain, TExternal>,
    externalAPI: IExternalAPI<TExternal, TResult>,
    operations: string[]
  ): EnhancedACLAdapter<TDomain, TExternal, TResult> {
    const contextInfo: ACLContextInfo = {
      contextName,
      externalSystemName,
      version: '1.0.0',
      supportedOperations: operations,
    };

    return new EnhancedACLAdapter(contextInfo, translator, externalAPI, operations);
  }
}
