/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';

import { ACLError } from './acl-errors';
import type {
  ACLContextInfo,
  ACLMiddleware,
  ExecuteOptions,
  IACLAdapter,
  IExternalAPI,
  IModelTranslator,
} from './acl.interfaces';

export abstract class BaseACLAdapter<TDomainModel, TExternalModel, TResult = any>
  implements IACLAdapter<TDomainModel, TExternalModel, TResult>
{
  private readonly supportedOps = new Set<string>();
  protected middlewares: ACLMiddleware[] = [];
  protected readonly logger = Logger.forContext(this.constructor.name);

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
    this.logger.debug('Executing ACL operation', {
      operation,
      context: this.contextInfo.contextName,
      externalSystem: this.contextInfo.externalSystemName,
      correlationId: options.correlationId,
    });

    if (this.middlewares.length === 0) {
      return this.executeCore(operation, domainModel, options);
    }

    return this.buildMiddlewarePipeline(operation, domainModel, options);
  }

  async fetch(identifier: string): Promise<Result<TDomainModel, ACLError>> {
    this.logger.debug('Fetching from external system', {
      identifier,
      context: this.contextInfo.contextName,
      externalSystem: this.contextInfo.externalSystemName,
    });

    try {
      const externalModel = await this.externalAPI.fetch(identifier);
      const domainModel = this.translator.fromExternal(externalModel);

      this.logger.info('Fetch completed successfully', {
        identifier,
        context: this.contextInfo.contextName,
      });

      return Result.ok(domainModel);
    } catch (error) {
      this.logger.error(
        'Fetch failed',
        error instanceof Error ? error : undefined,
        {
          identifier,
          context: this.contextInfo.contextName,
          error: error instanceof Error ? error.message : String(error),
        }
      );
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
        this.logger.warn('Unsupported operation attempted', {
          operation,
          context: this.contextInfo.contextName,
          supportedOperations: Array.from(this.supportedOps),
        });
        return Result.fail(ACLError.unsupportedOperation(this.contextInfo.contextName, operation));
      }

      const externalModel = this.translator.toExternal(domainModel);

      const result = options.timeout
        ? await this.executeWithTimeout(operation, externalModel, options.timeout)
        : await this.externalAPI.execute(operation, externalModel);

      this.logger.info('ACL operation completed successfully', {
        operation,
        context: this.contextInfo.contextName,
        correlationId: options.correlationId,
      });

      return Result.ok(result);
    } catch (error) {
      this.logger.error(
        'ACL operation failed',
        error instanceof Error ? error : undefined,
        {
          operation,
          context: this.contextInfo.contextName,
          error: error instanceof Error ? error.message : String(error),
          correlationId: options.correlationId,
        }
      );
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
