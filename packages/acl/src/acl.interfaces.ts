/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches/ddd-utils';
import type { ACLError } from './acl-errors';
import type { TypedOperation } from './typed-operations';

/**
 * @llm-summary Contract for a c l adapter functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ACLAdapter interface implementing integration layer component for a c l adapter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteACLAdapter implements IACLAdapter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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

/**
 * @llm-summary Contract for a c l middleware functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ACLMiddleware interface implementing integration layer component for a c l middleware operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteACLMiddleware implements ACLMiddleware {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ACLMiddleware {
  execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>>;
}

/**
 * @llm-summary Contract for enhanced a c l adapter functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * EnhancedACLAdapter interface implementing integration layer component for enhanced a c l adapter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEnhancedACLAdapter implements IEnhancedACLAdapter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
 * @llm-summary Contract for model translator functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ModelTranslator interface implementing integration layer component for model translator operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteModelTranslator implements IModelTranslator {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IModelTranslator<TDomain, TExternal> {
  toExternal(domainModel: TDomain): TExternal;
  fromExternal(externalModel: TExternal): TDomain;
  validateDomain?(domainModel: TDomain): Result<void, Error>;
  validateExternal?(externalModel: TExternal): Result<void, Error>;
}

/**
 * @llm-summary Contract for external a p i functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ExternalAPI interface implementing integration layer component for external a p i operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExternalAPI implements IExternalAPI {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IExternalAPI<TExternalModel, TResult> {
  execute(operation: string, model: TExternalModel): Promise<TResult>;
  fetch(identifier: string): Promise<TExternalModel>;
  healthCheck(): Promise<boolean>;
}

/**
 * @llm-summary Contract for a c l context info functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ACLContextInfo interface implementing integration layer component for a c l context info operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteACLContextInfo implements ACLContextInfo {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for execute options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ExecuteOptions interface implementing integration layer component for execute options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExecuteOptions implements ExecuteOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ExecuteOptions {
  version?: string;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
  correlationId?: string;
}
