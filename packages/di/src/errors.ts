import { BaseError } from '@vytches-ddd/domain-primitives';
import type { ServiceToken } from './types';

/**
 * Base error for dependency injection operations
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
 * Error thrown when a service cannot be found during resolution
 */
export class ServiceNotFoundError extends DIError {
  constructor(token: ServiceToken, context?: string) {
    const tokenString = typeof token === 'string' ? token : 
                       typeof token === 'symbol' ? token.toString() : 
                       token.name || 'Unknown';
    
    const contextString = context ? ` in context '${context}'` : '';
    const message = `Service '${tokenString}' not found${contextString}`;
    
    super(message);
    this.name = 'ServiceNotFoundError';
  }
}

/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends DIError {
  constructor(resolutionChain: ServiceToken[]) {
    const chainString = resolutionChain
      .map(token => typeof token === 'string' ? token : 
                   typeof token === 'symbol' ? token.toString() : 
                   token.name || 'Unknown')
      .join(' -> ');
    
    const message = `Circular dependency detected: ${chainString}`;
    
    super(message);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when a service registration is invalid
 */
export class InvalidRegistrationError extends DIError {
  constructor(token: ServiceToken, reason: string) {
    const tokenString = typeof token === 'string' ? token : 
                       typeof token === 'symbol' ? token.toString() : 
                       token.name || 'Unknown';
    
    const message = `Invalid registration for service '${tokenString}': ${reason}`;
    
    super(message);
    this.name = 'InvalidRegistrationError';
  }
}

/**
 * Error thrown when a service is already registered
 */
export class ServiceAlreadyRegisteredError extends DIError {
  constructor(token: ServiceToken, context?: string) {
    const tokenString = typeof token === 'string' ? token : 
                       typeof token === 'symbol' ? token.toString() : 
                       token.name || 'Unknown';
    
    const contextString = context ? ` in context '${context}'` : '';
    const message = `Service '${tokenString}' is already registered${contextString}`;
    
    super(message);
    this.name = 'ServiceAlreadyRegisteredError';
  }
}

/**
 * Error thrown when container configuration is invalid
 */
export class ContainerConfigurationError extends DIError {
  constructor(message: string, cause?: Error) {
    super(`Container configuration error: ${message}`, cause);
    this.name = 'ContainerConfigurationError';
  }
}

/**
 * Error thrown when container is disposed and operations are attempted
 */
export class ContainerDisposedError extends DIError {
  constructor() {
    super('Container has been disposed and cannot be used');
    this.name = 'ContainerDisposedError';
  }
}