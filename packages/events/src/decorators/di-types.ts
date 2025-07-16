/* eslint-disable @typescript-eslint/no-explicit-any */

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
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

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
  /** Service lifetime for DI registration */
  lifetime?: ServiceLifetime;

  /** Context for scoped services */
  context?: string;

  /** Tags for service organization */
  tags?: string[];

  /** Whether to auto-register with DI container (default: true) */
  autoRegister?: boolean;
}

/**
 * @llm-summary Contract for event handler options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * EventHandlerOptions interface implementing architectural component for event handler options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventHandlerOptions implements EventHandlerOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface EventHandlerOptions extends DIDecoratorOptions {
  /** Whether handler is active */
  active?: boolean;

  /** Available from version */
  availableFrom?: string;

  /** Handler priority (higher = earlier execution) */
  priority?: number;

  /** Context filter for event handling - can be single context, multiple contexts, or undefined for all */
  eventContext?: string | string[];

  /** Additional metadata */
  [key: string]: any;
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
  /** Handler type identifier */
  type: 'event';

  /** Event type constructor */
  eventType: new (...args: any[]) => any;

  /** Handler constructor */
  handlerType: new (...args: any[]) => any;

  /** DI options from decorator */
  options: EventHandlerOptions;

  /** Registration timestamp */
  registeredAt: Date;

  /** Whether registered with DI container */
  registeredWithDI: boolean;
}
