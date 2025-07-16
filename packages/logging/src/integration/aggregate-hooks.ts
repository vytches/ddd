/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '../core/index';
import { DefaultLogger } from '../logger';

/**
 * @llm-summary Contract for state change logging options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * StateChangeLoggingOptions interface implementing infrastructure service for state change logging options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteStateChangeLoggingOptions implements StateChangeLoggingOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StateChangeLoggingOptions {
  logLevel?: 'debug' | 'info';
  includeValues?: boolean;
  maskSensitiveFields?: boolean;
}

/**
 * @llm-summary log state changes function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * LogStateChanges function implementing infrastructure service for log state changes operations.
 *
 *
 * @param {StateChangeLoggingOptions = {}} options - options parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = LogStateChanges(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => LogStateChanges(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function LogStateChanges(options: StateChangeLoggingOptions = {}): MethodDecorator {
  return function (_target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: any, ...args: any[]) {
      const logger = getOrCreateAggregateLogger(this);
      const methodName = String(propertyKey);
      const logLevel = options.logLevel || 'debug';

      // Capture state before
      const stateBefore = options.includeValues ? this.captureState?.() : undefined;

      logger[logLevel](`[Aggregate] Executing ${methodName}`, {
        aggregateId: this.id,
        aggregateType: this.constructor.name,
        method: methodName,
        ...(stateBefore && { stateBefore }),
      });

      try {
        const result = originalMethod.apply(this, args);

        // Handle both sync and async results
        if (result instanceof Promise) {
          return result
            .then(asyncResult => {
              this.logStateChangeSuccess(logger, methodName, stateBefore, options);
              return asyncResult;
            })
            .catch(error => {
              this.logStateChangeError(logger, methodName, error);
              throw error;
            });
        } else {
          this.logStateChangeSuccess(logger, methodName, stateBefore, options);
          return result;
        }
      } catch (error) {
        this.logStateChangeError(logger, methodName, error);
        throw error;
      }
    };
  };
}

/**
 * @llm-summary log domain events function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * LogDomainEvents function implementing infrastructure service for log domain events operations.
 *
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = LogDomainEvents();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => LogDomainEvents());
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function LogDomainEvents(): MethodDecorator {
  return function (_target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: any, ...args: any[]) {
      const logger = getOrCreateAggregateLogger(this);

      // Capture events before execution
      const eventsBefore = this.getUncommittedEvents?.() || [];
      const eventsBeforeCount = eventsBefore.length;

      const result = originalMethod.apply(this, args);

      // Capture events after execution
      const eventsAfter = this.getUncommittedEvents?.() || [];
      const newEvents = eventsAfter.slice(eventsBeforeCount);

      if (newEvents.length > 0) {
        logger.info(`[Aggregate] Domain events raised`, {
          aggregateId: this.id,
          aggregateType: this.constructor.name,
          method: String(propertyKey),
          eventsCount: newEvents.length,
          eventTypes: newEvents.map((e: any) => e.constructor.name),
        });
      }

      return result;
    };
  };
}

function getOrCreateAggregateLogger(instance: any): Logger {
  if (!instance._logger) {
    const contextName = `${instance.constructor.name}Aggregate`;
    instance._logger = DefaultLogger.forContext(contextName);
  }
  return instance._logger;
}

// Mixin methods for aggregate classes

/**
 * @llm-summary AggregateLoggingMixin constant
 * @llm-domain Infrastructure
 *
 * @description
 * AggregateLoggingMixin constant implementing infrastructure service for aggregate logging mixin operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(AggregateLoggingMixin);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const AggregateLoggingMixin = {
  logStateChangeSuccess(
    this: any,
    logger: Logger,
    methodName: string,
    stateBefore: any,
    options: StateChangeLoggingOptions
  ): void {
    const logLevel = options.logLevel || 'debug';
    const stateAfter = options.includeValues ? this.captureState?.() : undefined;

    logger[logLevel](`[Aggregate] ${methodName} completed`, {
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      method: methodName,
      success: true,
      ...(stateBefore &&
        stateAfter && {
          stateChanged: this.hasStateChanged?.(stateBefore, stateAfter) ?? true,
        }),
      ...(stateAfter && { stateAfter }),
    });
  },

  logStateChangeError(this: any, logger: Logger, methodName: string, error: any): void {
    logger.error(`[Aggregate] ${methodName} failed`, error, {
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      method: methodName,
      success: false,
    });
  },
};
