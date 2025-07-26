import { BaseError } from '@vytches/ddd-domain-primitives';
import type { ServiceToken } from './types';

/**
 * @llm-summary DIError class for d i error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * DIError class implementing infrastructure service for d i error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DIError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new DIError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class DIError extends BaseError {
  public readonly cause?: Error | undefined;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'DIError';
    if (cause !== undefined) {
      (this as any).cause = cause;
    }
  }
}

/**
 * @llm-summary ServiceNotFoundError class for service not found error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ServiceNotFoundError class implementing infrastructure service for service not found error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ServiceNotFoundError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ServiceNotFoundError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ServiceNotFoundError extends DIError {
  constructor(token: ServiceToken, context?: string) {
    const tokenString =
      typeof token === 'string'
        ? token
        : typeof token === 'symbol'
          ? token.toString()
          : token.name || 'Unknown';

    const contextString = context ? ` in context '${context}'` : '';
    const message = `Service '${tokenString}' not found${contextString}`;

    super(message);
    this.name = 'ServiceNotFoundError';
  }
}

/**
 * @llm-summary CircularDependencyError class for circular dependency error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * CircularDependencyError class implementing infrastructure service for circular dependency error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CircularDependencyError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CircularDependencyError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CircularDependencyError extends DIError {
  constructor(resolutionChain: ServiceToken[]) {
    const chainString = resolutionChain
      .map(token =>
        typeof token === 'string'
          ? token
          : typeof token === 'symbol'
            ? token.toString()
            : token.name || 'Unknown'
      )
      .join(' -> ');

    const message = `Circular dependency detected: ${chainString}`;

    super(message);
    this.name = 'CircularDependencyError';
  }
}

/**
 * @llm-summary InvalidRegistrationError class for invalid registration error operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * InvalidRegistrationError class implementing infrastructure service for invalid registration error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new InvalidRegistrationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new InvalidRegistrationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class InvalidRegistrationError extends DIError {
  constructor(token: ServiceToken, reason: string) {
    const tokenString =
      typeof token === 'string'
        ? token
        : typeof token === 'symbol'
          ? token.toString()
          : token.name || 'Unknown';

    const message = `Invalid registration for service '${tokenString}': ${reason}`;

    super(message);
    this.name = 'InvalidRegistrationError';
  }
}

/**
 * @llm-summary ServiceAlreadyRegisteredError class for service already registered error operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * ServiceAlreadyRegisteredError class implementing infrastructure service for service already registered error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ServiceAlreadyRegisteredError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ServiceAlreadyRegisteredError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ServiceAlreadyRegisteredError extends DIError {
  constructor(token: ServiceToken, context?: string) {
    const tokenString =
      typeof token === 'string'
        ? token
        : typeof token === 'symbol'
          ? token.toString()
          : token.name || 'Unknown';

    const contextString = context ? ` in context '${context}'` : '';
    const message = `Service '${tokenString}' is already registered${contextString}`;

    super(message);
    this.name = 'ServiceAlreadyRegisteredError';
  }
}

/**
 * @llm-summary ContainerConfigurationError class for container configuration error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ContainerConfigurationError class implementing infrastructure service for container configuration error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ContainerConfigurationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ContainerConfigurationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ContainerConfigurationError extends DIError {
  constructor(message: string, cause?: Error) {
    super(`Container configuration error: ${message}`, cause);
    this.name = 'ContainerConfigurationError';
  }
}

/**
 * @llm-summary ContainerDisposedError class for container disposed error operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * ContainerDisposedError class implementing infrastructure service for container disposed error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ContainerDisposedError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ContainerDisposedError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ContainerDisposedError extends DIError {
  constructor() {
    super('Container has been disposed and cannot be used');
    this.name = 'ContainerDisposedError';
  }
}
