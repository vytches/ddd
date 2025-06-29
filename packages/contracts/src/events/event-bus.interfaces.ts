/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDomainEvent } from './domain-event-interfaces';

/**
 * Abstract class for event buses (originally from events package)
 * Uses abstract class for DI framework compatibility
 * Generic type TEvent allows handling different event types (domain, integration, audit)
 */
export abstract class IEventBus<TEvent = IDomainEvent> {
  /**
   * Publish an event to all subscribed handlers
   */
  abstract publish(event: TEvent): Promise<void>;

  /**
   * Subscribe a function to handle events of a specific type
   */
  abstract subscribe<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: (event: T) => Promise<void> | void
  ): void;

  /**
   * Register a class-based handler for events of a specific type
   */
  abstract registerHandler<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: {
      handle(event: T): Promise<void> | void;
    }
  ): void;

  /**
   * Unsubscribe from an event type
   */
  abstract unsubscribe(
    eventType: string | (new (...args: any[]) => TEvent),
    handler:
      | ((event: TEvent) => Promise<void> | void)
      | { handle(event: TEvent): Promise<void> | void }
  ): void;

  /**
   * Publish multiple events
   */
  abstract publishMany(events: TEvent[]): Promise<void>;
}

/**
 * Registry interface for managing event buses
 */
export interface IEventBusRegistry {
  /**
   * Register an event bus for a specific context
   */
  register(name: string, bus: IEventBus): void;

  /**
   * Get an event bus by name
   */
  get(name: string): IEventBus | undefined;

  /**
   * Check if a bus is registered
   */
  has(name: string): boolean;

  /**
   * Remove a bus from registry
   */
  remove(name: string): boolean;
}

/**
 * Base options for all event bus implementations
 */
export interface BaseEventBusOptions {
  /**
   * Enable or disable event processing logging
   */
  enableLogging?: boolean;

  /**
   * Custom error handler for event processing errors
   */
  onError?: (error: Error, eventType: string) => void;

  /**
   * Middleware pipeline to process events
   */
  middlewares?: EventBusMiddleware[];

  /**
   * Optional custom logger function
   */
  logger?: (message: string) => void;
}

/**
 * Event bus middleware function type
 * Enables creation of processing pipelines for events
 */
export type EventBusMiddleware = (
  next: (event: any) => Promise<void>
) => (event: any) => Promise<void>;
