/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import { EVENT_HANDLER_METADATA, EVENT_HANDLER_OPTIONS } from '@vytches/ddd-contracts';
import type { EventHandlerOptions, DIHandlerMetadata } from './di-types';

// Re-export for compatibility
export type { EventHandlerOptions };

/**
 * @llm-summary event handler function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * EventHandler function implementing architectural component for event handler operations.
 *
 *
 * @param {new (...args: any[]} eventType - eventType parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = EventHandler(eventType);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => EventHandler(eventType));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function EventHandler<T extends IDomainEvent>(
  eventType: new (...args: any[]) => T,
  options: EventHandlerOptions = {}
) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>
  ) {
    const metadata = { eventType };

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
        eventType,
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
          return eventType;
        };
      }

      return target;
    }
  };
}
