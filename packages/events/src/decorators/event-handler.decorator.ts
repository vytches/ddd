/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IDomainEvent } from '@vytches/ddd-contracts';
import { EVENT_HANDLER_METADATA, EVENT_HANDLER_OPTIONS } from '@vytches/ddd-contracts';
import 'reflect-metadata';
import type { DIHandlerMetadata, EventHandlerOptions } from './di-types';

// Re-export for compatibility
export type { EventHandlerOptions };

/**
 * Decorator for marking classes and methods as event handlers with DI support.
 * Enables declarative event handler registration and auto-discovery.
 *
 * @param eventName Constructor of the event type to handle
 * @param options Handler configuration options
 * @returns Decorator function for classes or methods
 * @since 1.0.0
 * @public
 */
export function EventHandler<T extends IDomainEvent>(
  eventName: new (...args: any[]) => T,
  options: EventHandlerOptions = {}
) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>
  ) {
    const metadata = { eventName };

    if (propertyKey !== undefined && descriptor !== undefined) {
      // Method decorator usage
      Reflect.defineMetadata(EVENT_HANDLER_METADATA, metadata, descriptor.value);
      Reflect.defineMetadata(EVENT_HANDLER_OPTIONS, options, descriptor.value);
      return descriptor;
    } else {
      // Class decorator usage
      // Phase 1: Maintain existing functionality
      Reflect.defineMetadata(EVENT_HANDLER_METADATA, metadata, target);
      Reflect.defineMetadata(EVENT_HANDLER_OPTIONS, options, target);

      // Phase 2: Enhanced DI integration
      const diOptions = options || {};
      const diMetadata: DIHandlerMetadata = {
        type: 'event',
        eventName,
        handlerType: target,
        options: diOptions,
        registeredAt: new Date(),
        registeredWithDI: false,
      };

      // Store enhanced metadata for auto-discovery
      Reflect.defineMetadata('di:event-handler', diMetadata, target);
      Reflect.defineMetadata('di:handler-type', 'event', target);

      // Store event context for unified event bus
      if (options.eventContext !== undefined) {
        Reflect.defineMetadata('event:context', options.eventContext, target);
      }

      // Phase 2: Auto-register with DI container if available and enabled
      // Note: Registration is deferred to avoid circular dependencies
      // Actual DI registration happens during VytchesDDD.discoverAndRegisterHandlers()
      if (diOptions.autoRegister !== false) {
        // Mark as pending DI registration for auto-discovery
        diMetadata.registeredWithDI = false; // Will be updated by auto-discovery
        Reflect.defineMetadata('di:registration-pending', true, target);
      }

      // Add helper method for adapter compatibility
      if (!target.prototype.getEventType) {
        target.prototype.getEventType = function () {
          return eventName;
        };
      }

      return target;
    }
  };
}
