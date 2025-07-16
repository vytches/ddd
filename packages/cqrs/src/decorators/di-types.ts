/**
 * @llm-summary Type definition for service lifetime
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * ServiceLifetime type implementing architectural component for service lifetime operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ServiceLifetime = {} as ServiceLifetime;
 * ```
 *
 * @since 1.0.0
 * @public
 */

// Import DI types (will be available when DI package is consumed)
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

/**
 * @llm-summary Type definition for service token
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * ServiceToken type implementing architectural component for service token operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ServiceToken = {} as ServiceToken;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ServiceToken<T = unknown> = string | symbol | (new (...args: unknown[]) => T);

/**
 * @llm-summary Contract for d i decorator options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * DIDecoratorOptions interface implementing architectural component for d i decorator options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDIDecoratorOptions implements DIDecoratorOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for command handler options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CommandHandlerOptions interface implementing architectural component for command handler options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCommandHandlerOptions implements CommandHandlerOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CommandHandlerOptions extends DIDecoratorOptions {
  /** Validation strategy for commands */
  validation?: 'strict' | 'loose' | 'none';
  /** Timeout in milliseconds for command execution */
  timeout?: number;
}

/**
 * @llm-summary Contract for query handler options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * QueryHandlerOptions interface implementing architectural component for query handler options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteQueryHandlerOptions implements QueryHandlerOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for d i handler metadata functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * DIHandlerMetadata interface implementing architectural component for d i handler metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDIHandlerMetadata implements DIHandlerMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
