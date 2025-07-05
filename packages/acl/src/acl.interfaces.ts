/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches-ddd/utils';
import type { ACLError } from './acl-errors';
import type { TypedOperation } from './typed-operations';

/**
 * Core ACL Adapter interface for synchronous request/response communication
 */
export interface IACLAdapter<TDomainModel, _TExternalModel, TResult = any> {
  execute(
    operation: string,
    domainModel: TDomainModel,
    options?: ExecuteOptions
  ): Promise<Result<TResult, ACLError>>;
  fetch(identifier: string): Promise<Result<TDomainModel, ACLError>>;
  supportsOperation(operation: string): boolean;
  getContextInfo(): ACLContextInfo;
}

export interface ACLMiddleware {
  execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>>;
}

export interface IEnhancedACLAdapter<TDomain, TExternal, TResult = any>
  extends IACLAdapter<TDomain, TExternal, TResult> {
  use(middleware: ACLMiddleware): this;
  executeTyped<TInput, TOutput>(
    operation: TypedOperation<TInput, TOutput>,
    domainModel: TDomain,
    options?: ExecuteOptions
  ): Promise<Result<TOutput, ACLError>>;
}

/**
 * Model translator for domain <-> external format conversion
 */
export interface IModelTranslator<TDomain, TExternal> {
  toExternal(domainModel: TDomain): TExternal;
  fromExternal(externalModel: TExternal): TDomain;
  validateDomain?(domainModel: TDomain): Result<void, Error>;
  validateExternal?(externalModel: TExternal): Result<void, Error>;
}

/**
 * External API interface for synchronous operations
 */
export interface IExternalAPI<TExternalModel, TResult> {
  execute(operation: string, model: TExternalModel): Promise<TResult>;
  fetch(identifier: string): Promise<TExternalModel>;
  healthCheck(): Promise<boolean>;
}

export interface ACLContextInfo {
  readonly contextName: string;
  readonly externalSystemName: string;
  readonly version: string;
  readonly supportedOperations: readonly string[];
  readonly metadata?: {
    description?: string;
    owner?: string;
    documentation?: string;
    baseUrl?: string;
  };
}

export interface ExecuteOptions {
  version?: string;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
  correlationId?: string;
}
