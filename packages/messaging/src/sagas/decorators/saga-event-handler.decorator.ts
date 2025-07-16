import 'reflect-metadata';
import type { SagaEventHandlerOptions, SagaMetadata } from '../interfaces';
import { SAGA_METADATA_KEY } from './saga.decorator';
import { SagaConfigurationError } from '../errors';

/**
 * @llm-summary saga event handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * SagaEventHandler function implementing integration layer component for saga event handler operations.
 *
 *
 * @param {SagaEventHandlerOptions} options - options parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = SagaEventHandler(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => SagaEventHandler(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function SagaEventHandler(options: SagaEventHandlerOptions): MethodDecorator;

/**
 * @llm-summary saga event handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * SagaEventHandler function implementing integration layer component for saga event handler operations.
 *
 *
 * @param {string} eventType - eventType parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = SagaEventHandler(eventType);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => SagaEventHandler(eventType));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function SagaEventHandler(eventType: string): MethodDecorator;

/**
 * @llm-summary saga event handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * SagaEventHandler function implementing integration layer component for saga event handler operations.
 *
 *
 * @param {string[]} eventTypes - eventTypes parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = SagaEventHandler(eventTypes);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => SagaEventHandler(eventTypes));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function SagaEventHandler(eventTypes: string[]): MethodDecorator;

/**
 * @llm-summary saga event handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * SagaEventHandler function implementing integration layer component for saga event handler operations.
 *
 *
 * @param {SagaEventHandlerOptions | string | string[]} optionsOrEventType - optionsOrEventType parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = SagaEventHandler(optionsOrEventType);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => SagaEventHandler(optionsOrEventType));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary start saga function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * StartSaga function implementing integration layer component for start saga operations.
 *
 *
 * @param {Partial<SagaEventHandlerOptions> = {}} options - options parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = StartSaga(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => StartSaga(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary end saga function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * EndSaga function implementing integration layer component for end saga operations.
 *
 *
 * @param {Partial<SagaEventHandlerOptions> = {}} options - options parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = EndSaga(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => EndSaga(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary get event handler methods function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * getEventHandlerMethods function implementing integration layer component for get event handler methods operations.
 *
 *
 * @param {any} target - target parameter
 * @returns {Map<string, SagaEventHandlerOptions>} Returns Map<string, SagaEventHandlerOptions>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getEventHandlerMethods(target);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => getEventHandlerMethods(target));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getEventHandlerMethods(target: any): Map<string, SagaEventHandlerOptions> {
  const metadata: SagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target) || {};
  return metadata.eventHandlers || new Map();
}

/**
 * @llm-summary is event handler method function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * isEventHandlerMethod function implementing integration layer component for is event handler method operations.
 *
 *
 * @param {any} target - target parameter
 * @param {string} methodName - methodName parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isEventHandlerMethod(target, methodName);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => isEventHandlerMethod(target, methodName));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isEventHandlerMethod(target: any, methodName: string): boolean {
  const methodMetadataKey = `saga:eventHandler:${methodName}`;
  return Reflect.hasMetadata(methodMetadataKey, target);
}
