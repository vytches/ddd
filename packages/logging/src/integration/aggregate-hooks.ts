/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '../core/index.js';
import { DefaultLogger } from '../logger.js';

export interface StateChangeLoggingOptions {
  logLevel?: 'debug' | 'info';
  includeValues?: boolean;
  maskSensitiveFields?: boolean;
}

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
          return result.then((asyncResult) => {
            this.logStateChangeSuccess(logger, methodName, stateBefore, options);
            return asyncResult;
          }).catch((error) => {
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
      ...(stateBefore && stateAfter && {
        stateChanged: this.hasStateChanged?.(stateBefore, stateAfter) ?? true
      }),
      ...(stateAfter && { stateAfter }),
    });
  },

  logStateChangeError(
    this: any,
    logger: Logger,
    methodName: string,
    error: any
  ): void {
    logger.error(`[Aggregate] ${methodName} failed`, error, {
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      method: methodName,
      success: false,
    });
  },
};
