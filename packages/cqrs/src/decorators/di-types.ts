/**
 * DI Integration types for Phase 2 CQRS enhancement
 * Extends existing decorators with dependency injection capabilities
 */

// Import DI types (will be available when DI package is consumed)
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';
export type ServiceToken<T = any> = string | symbol | (new (...args: any[]) => T);

/**
 * DI-related options for CQRS decorators
 * Enhances existing decorator functionality without breaking changes
 */
export interface DIDecoratorOptions {
  /** Service ID for DI container registration */
  serviceId?: string;

  /** Service lifetime for DI container registration */
  lifetime?: ServiceLifetime;

  /** Bounded context for context-aware DI resolution */
  context?: string;

  /** Auto-register handler with DI container (default: true) */
  autoRegister?: boolean;

  /** Explicit dependencies for documentation and validation */
  dependencies?: ServiceToken[];

  /** Service tags for organization and discovery */
  tags?: string[];

  /** Context resolution strategy */
  contextResolver?: 'auto' | 'explicit' | 'none';

  /** Fallback to global container if not found in context */
  fallbackToGlobal?: boolean;
}

/**
 * Enhanced options for CommandHandler decorator
 */
export interface CommandHandlerOptions extends DIDecoratorOptions {
  /** Validation strategy for commands */
  validation?: 'strict' | 'loose' | 'none';
  /** Timeout in milliseconds for command execution */
  timeout?: number;
}

/**
 * Enhanced options for QueryHandler decorator
 */
export interface QueryHandlerOptions extends DIDecoratorOptions {
  /** Enable caching for query results */
  cacheable?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Timeout in milliseconds for query execution */
  timeout?: number;
}

/**
 * Metadata stored for DI-enhanced handlers
 */
export interface DIHandlerMetadata {
  /** Handler type (command/query/event) */
  type: 'command' | 'query' | 'event';

  /** Message type constructor */
  messageType: new (...args: any[]) => any;

  /** Handler constructor */
  handlerType: new (...args: any[]) => any;

  /** DI options */
  options: DIDecoratorOptions;

  /** Registration timestamp */
  registeredAt: Date;

  /** Auto-registration status */
  registeredWithDI: boolean;
}
