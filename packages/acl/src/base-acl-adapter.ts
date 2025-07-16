/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Result } from '@vytches-ddd/utils';

import type {
  IACLAdapter,
  IExternalAPI,
  IModelTranslator,
  ACLContextInfo,
  ExecuteOptions,
  ACLMiddleware,
} from './acl.interfaces';
import { ACLError } from './acl-errors';

/**
 * @llm-summary BaseACLAdapter class for base a c l adapter operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * BaseACLAdapter class implementing integration layer component for base a c l adapter operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseACLAdapter();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseACLAdapter());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseACLAdapter<TDomainModel, TExternalModel, TResult = any>
  implements IACLAdapter<TDomainModel, TExternalModel, TResult>
{
  private readonly supportedOps = new Set<string>();
  protected middlewares: ACLMiddleware[] = [];

  constructor(
    protected readonly contextInfo: ACLContextInfo,
    protected readonly translator: IModelTranslator<TDomainModel, TExternalModel>,
    protected readonly externalAPI: IExternalAPI<TExternalModel, TResult>
  ) {
    // registerSupportedOperations() will be called by subclasses after initialization
  }

  use(middleware: ACLMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(
    operation: string,
    domainModel: TDomainModel,
    options: ExecuteOptions = {}
  ): Promise<Result<TResult, ACLError>> {
    if (this.middlewares.length === 0) {
      return this.executeCore(operation, domainModel, options);
    }

    return this.buildMiddlewarePipeline(operation, domainModel, options);
  }

  async fetch(identifier: string): Promise<Result<TDomainModel, ACLError>> {
    try {
      const externalModel = await this.externalAPI.fetch(identifier);
      const domainModel = this.translator.fromExternal(externalModel);
      return Result.ok(domainModel);
    } catch (error) {
      return Result.fail(this.createContextualError('FETCH', error as Error, {}));
    }
  }

  supportsOperation(operation: string): boolean {
    return this.supportedOps.has(operation);
  }

  getContextInfo(): ACLContextInfo {
    return { ...this.contextInfo };
  }

  protected registerOperation(operation: string): void {
    this.supportedOps.add(operation);
  }

  protected abstract registerSupportedOperations(): void;

  protected async executeCore(
    operation: string,
    domainModel: TDomainModel,
    options: ExecuteOptions
  ): Promise<Result<TResult, ACLError>> {
    try {
      if (!this.supportsOperation(operation)) {
        return Result.fail(ACLError.unsupportedOperation(this.contextInfo.contextName, operation));
      }

      const externalModel = this.translator.toExternal(domainModel);

      const result = options.timeout
        ? await this.executeWithTimeout(operation, externalModel, options.timeout)
        : await this.externalAPI.execute(operation, externalModel);

      return Result.ok(result);
    } catch (error) {
      return Result.fail(this.createContextualError(operation, error as Error, options));
    }
  }

  private buildMiddlewarePipeline(
    operation: string,
    domainModel: TDomainModel,
    options: ExecuteOptions
  ): Promise<Result<TResult, ACLError>> {
    let index = 0;

    const next = (): Promise<Result<TResult, ACLError>> => {
      if (index >= this.middlewares.length) {
        return this.executeCore(operation, domainModel, options);
      }

      const middleware = this.middlewares[index++];
      return middleware!.execute(operation, domainModel, options, next);
    };

    return next();
  }

  private async executeWithTimeout(
    operation: string,
    externalModel: TExternalModel,
    timeoutMs: number
  ): Promise<TResult> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    );

    return Promise.race([this.externalAPI.execute(operation, externalModel), timeoutPromise]);
  }

  private createContextualError(
    operation: string,
    error: Error,
    options: ExecuteOptions
  ): ACLError {
    const aclError = ACLError.operationFailed(this.contextInfo.contextName, operation, error);

    // Add correlation context
    if (options.correlationId) {
      aclError.metadata = {
        ...aclError.metadata,
        correlationId: options.correlationId,
      };
    }

    // Add custom metadata
    if (options.metadata) {
      aclError.metadata = {
        ...aclError.metadata,
        ...options.metadata,
      };
    }

    return aclError;
  }
}

/**
 * @llm-summary SimpleACLAdapter class for simple a c l adapter operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * SimpleACLAdapter class implementing integration layer component for simple a c l adapter operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SimpleACLAdapter();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SimpleACLAdapter());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SimpleACLAdapter<TDomain, TExternal, TResult = any> extends BaseACLAdapter<
  TDomain,
  TExternal,
  TResult
> {
  private operations: string[];

  constructor(
    contextInfo: ACLContextInfo,
    translator: IModelTranslator<TDomain, TExternal>,
    externalAPI: IExternalAPI<TExternal, TResult>,
    operations: string[]
  ) {
    super(contextInfo, translator, externalAPI);
    this.operations = operations;
    // Register operations after initialization
    this.registerSupportedOperations();
  }

  protected registerSupportedOperations(): void {
    if (this.operations) {
      this.operations.forEach(op => this.registerOperation(op));
    }
  }

  static create<TDomain, TExternal, TResult = any>(
    contextName: string,
    externalSystemName: string,
    translator: IModelTranslator<TDomain, TExternal>,
    externalAPI: IExternalAPI<TExternal, TResult>,
    operations: string[]
  ): SimpleACLAdapter<TDomain, TExternal, TResult> {
    const contextInfo: ACLContextInfo = {
      contextName,
      externalSystemName,
      version: '1.0.0',
      supportedOperations: operations,
    };

    return new SimpleACLAdapter(contextInfo, translator, externalAPI, operations);
  }
}
