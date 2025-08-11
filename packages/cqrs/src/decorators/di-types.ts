// Import DI types (will be available when DI package is consumed)
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

export type ServiceToken<T = unknown> = string | symbol | (new (...args: unknown[]) => T);

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

export interface CommandHandlerOptions extends DIDecoratorOptions {
  /** Validation strategy for commands */
  validation?: 'strict' | 'loose' | 'none';
  /** Timeout in milliseconds for command execution */
  timeout?: number;
}

export interface QueryHandlerOptions extends DIDecoratorOptions {
  /** Enable caching for query results */
  cacheable?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Timeout in milliseconds for query execution */
  timeout?: number;
}

export interface DIHandlerMetadata {
  /** Handler type (command/query/event) */
  type: 'command' | 'query' | 'event';

  /** Message type constructor */
  messageType: new (...args: unknown[]) => unknown;

  /** Handler constructor */
  handlerType: new (...args: unknown[]) => unknown;

  /** DI options */
  options: DIDecoratorOptions;

  /** Registration timestamp */
  registeredAt: Date;

  /** Auto-registration status */
  registeredWithDI: boolean;
}
