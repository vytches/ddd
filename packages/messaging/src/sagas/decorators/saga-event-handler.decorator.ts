import 'reflect-metadata';
import { SagaConfigurationError } from '../errors';
import type { SagaEventHandlerOptions, SagaMetadata } from '../interfaces';
import { SAGA_METADATA_KEY } from './saga.decorator';

export function SagaEventHandler(options: SagaEventHandlerOptions): MethodDecorator;

export function SagaEventHandler(eventType: string): MethodDecorator;

export function SagaEventHandler(eventTypes: string[]): MethodDecorator;

export function SagaEventHandler(
  optionsOrEventType: SagaEventHandlerOptions | string | string[]
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Normalize options
    let options: SagaEventHandlerOptions;

    if (typeof optionsOrEventType === 'string') {
      options = { eventType: optionsOrEventType };
    } else if (Array.isArray(optionsOrEventType)) {
      options = { eventType: optionsOrEventType };
    } else {
      options = optionsOrEventType;
    }

    // Validate required options
    if (!options.eventType) {
      throw new SagaConfigurationError(
        'unknown',
        '@SagaEventHandler decorator requires eventType',
        ['eventType is required'],
        { usage: "@SagaEventHandler('OrderCreated')" }
      );
    }

    // Set default values
    const handlerOptions: SagaEventHandlerOptions = {
      eventType: options.eventType,
      canStartSaga: options.canStartSaga || false,
      canCompleteSaga: options.canCompleteSaga || false,
      correlationProperties: options.correlationProperties || [],
      stepName: options.stepName || String(propertyKey),
      ...(options.timeout !== undefined && { timeout: options.timeout }),
      maxRetries: options.maxRetries || 0,
      retryDelay: options.retryDelay || {
        initial: 1000,
        multiplier: 2,
        maximum: 30000,
      },
      idempotent: options.idempotent !== false, // Default to true
      order: options.order || 0,
    };

    // Get existing metadata or create new
    const existingMetadata: SagaMetadata =
      Reflect.getMetadata(SAGA_METADATA_KEY, target.constructor) || {};

    // Initialize event handlers map if it doesn't exist
    if (!existingMetadata.eventHandlers) {
      existingMetadata.eventHandlers = new Map();
    }

    // Store event handler metadata
    existingMetadata.eventHandlers.set(String(propertyKey), handlerOptions);

    // Update metadata
    Reflect.defineMetadata(SAGA_METADATA_KEY, existingMetadata, target.constructor);

    // Store method-specific metadata for runtime access
    const methodMetadataKey = `saga:eventHandler:${String(propertyKey)}`;
    Reflect.defineMetadata(methodMetadataKey, handlerOptions, target.constructor);

    return descriptor;
  };
}

export function StartSaga(options: Partial<SagaEventHandlerOptions> = {}): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Get existing event handler metadata
    const methodMetadataKey = `saga:eventHandler:${String(propertyKey)}`;
    const existingHandlerOptions: SagaEventHandlerOptions =
      Reflect.getMetadata(methodMetadataKey, target.constructor) || {};

    // Update with start saga capability
    const updatedOptions: SagaEventHandlerOptions = {
      ...existingHandlerOptions,
      ...options,
      canStartSaga: true,
    };

    // Update method metadata
    Reflect.defineMetadata(methodMetadataKey, updatedOptions, target.constructor);

    // Update class metadata
    const existingMetadata: SagaMetadata =
      Reflect.getMetadata(SAGA_METADATA_KEY, target.constructor) || {};
    if (!existingMetadata.eventHandlers) {
      existingMetadata.eventHandlers = new Map();
    }
    existingMetadata.eventHandlers.set(String(propertyKey), updatedOptions);
    Reflect.defineMetadata(SAGA_METADATA_KEY, existingMetadata, target.constructor);

    return descriptor;
  };
}

export function EndSaga(options: Partial<SagaEventHandlerOptions> = {}): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Get existing event handler metadata
    const methodMetadataKey = `saga:eventHandler:${String(propertyKey)}`;
    const existingHandlerOptions: SagaEventHandlerOptions =
      Reflect.getMetadata(methodMetadataKey, target.constructor) || {};

    // Update with end saga capability
    const updatedOptions: SagaEventHandlerOptions = {
      ...existingHandlerOptions,
      ...options,
      canCompleteSaga: true,
    };

    // Update method metadata
    Reflect.defineMetadata(methodMetadataKey, updatedOptions, target.constructor);

    // Update class metadata
    const existingMetadata: SagaMetadata =
      Reflect.getMetadata(SAGA_METADATA_KEY, target.constructor) || {};
    if (!existingMetadata.eventHandlers) {
      existingMetadata.eventHandlers = new Map();
    }
    existingMetadata.eventHandlers.set(String(propertyKey), updatedOptions);
    Reflect.defineMetadata(SAGA_METADATA_KEY, existingMetadata, target.constructor);

    return descriptor;
  };
}

/**
 * Get event handler metadata from a method
 * @param target - Target class
 * @param methodName - Method name
 */
export function getEventHandlerMetadata(
  target: any,
  methodName: string
): SagaEventHandlerOptions | undefined {
  const methodMetadataKey = `saga:eventHandler:${methodName}`;
  return Reflect.getMetadata(methodMetadataKey, target);
}

export function getEventHandlerMethods(target: any): Map<string, SagaEventHandlerOptions> {
  const metadata: SagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target) || {};
  return metadata.eventHandlers || new Map();
}

export function isEventHandlerMethod(target: any, methodName: string): boolean {
  const methodMetadataKey = `saga:eventHandler:${methodName}`;
  return Reflect.hasMetadata(methodMetadataKey, target);
}
