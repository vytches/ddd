/**
 * Service lifetime options for dependency injection.
 * Controls how long service instances live in the container.
 *
 * @public
 * @stable
 * @since 0.22.0
 */
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

/**
 * Base configuration options for dependency injection decorators.
 * Provides common DI settings for all decorator types.
 *
 * @public
 * @stable
 * @since 0.22.0
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
 * @public
 * @stable
 * @since 0.22.0
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

  /**
   * Bus scope for this handler.
   * - `'context'` (default) — handler registered in the bounded-context
   *   `LOCAL_EVENT_BUS` provided by `VytchesDDDModule.forFeature()`.
   * - `'global'` — handler registered in the application-wide event bus.
   *   Use for integration event handlers that cross bounded-context boundaries.
   */
  scope?: 'context' | 'global';

  /** Additional metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Internal metadata for DI handler registration and management.
 * Used by the DI system for auto-discovery and lifecycle tracking.
 *
 * @public
 * @stable
 * @since 0.22.0
 */
export interface DIHandlerMetadata {
  /** Handler type identifier */
  type: 'event';

  /** Event type constructor */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventName: new (...args: any[]) => any;

  /** Handler constructor */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlerType: new (...args: any[]) => any;

  /** DI options from decorator */
  options: EventHandlerOptions;

  /** Registration timestamp */
  registeredAt: Date;

  /** Whether registered with DI container */
  registeredWithDI: boolean;
}
