/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Service lifetime options for dependency injection.
 * Controls how long service instances live in the container.
 *
 * @since 1.0.0
 * @public
 */
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

/**
 * Base configuration options for dependency injection decorators.
 * Provides common DI settings for all decorator types.
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
 * Configuration options for event handler decorators.
 * Extends base DI options with handler-specific settings.
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
 * Internal metadata for DI handler registration and management.
 * Used by the DI system for auto-discovery and lifecycle tracking.
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
