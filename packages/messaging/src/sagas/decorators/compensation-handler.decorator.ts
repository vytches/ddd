import 'reflect-metadata';
import type { CompensationHandlerOptions, SagaMetadata } from '../interfaces';
import { SAGA_METADATA_KEY } from './saga.decorator';
import { SagaConfigurationError } from '../errors';

/**
 * @llm-summary compensation handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * CompensationHandler function implementing integration layer component for compensation handler operations.
 *
 * @param {CompensationHandlerOptions} options - options parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = CompensationHandler(options);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function CompensationHandler(options: CompensationHandlerOptions): MethodDecorator;

/**
 * @llm-summary compensation handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * CompensationHandler function implementing integration layer component for compensation handler operations.
 *
 * @param {string} stepName - stepName parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = CompensationHandler(stepName);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function CompensationHandler(stepName: string): MethodDecorator;

/**
 * @llm-summary compensation handler function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * CompensationHandler function implementing integration layer component for compensation handler operations.
 *
 * @param {CompensationHandlerOptions | string} optionsOrStepName - optionsOrStepName parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = CompensationHandler(optionsOrStepName);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function CompensationHandler(
  optionsOrStepName: CompensationHandlerOptions | string
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Normalize options
    const options: CompensationHandlerOptions =
      typeof optionsOrStepName === 'string' ? { stepName: optionsOrStepName } : optionsOrStepName;

    // Validate required options
    if (!options.stepName || options.stepName.trim() === '') {
      throw new SagaConfigurationError(
        'unknown',
        '@CompensationHandler decorator requires stepName',
        ['stepName is required'],
        { usage: "@CompensationHandler('processPayment')" }
      );
    }

    // Set default values
    const handlerOptions: CompensationHandlerOptions = {
      stepName: options.stepName,
      ...(options.timeout !== undefined && { timeout: options.timeout }),
      maxRetries: options.maxRetries || 3,
      critical: options.critical !== false, // Default to true
      order: options.order || 0,
    };

    // Get existing metadata or create new
    const existingMetadata: SagaMetadata =
      Reflect.getMetadata(SAGA_METADATA_KEY, target.constructor) || {};

    // Initialize compensation handlers map if it doesn't exist
    if (!existingMetadata.compensationHandlers) {
      existingMetadata.compensationHandlers = new Map();
    }

    // Store compensation handler metadata
    existingMetadata.compensationHandlers.set(String(propertyKey), handlerOptions);

    // Update metadata
    Reflect.defineMetadata(SAGA_METADATA_KEY, existingMetadata, target.constructor);

    // Store method-specific metadata for runtime access
    const methodMetadataKey = `saga:compensationHandler:${String(propertyKey)}`;
    Reflect.defineMetadata(methodMetadataKey, handlerOptions, target.constructor);

    return descriptor;
  };
}

/**
 * Get compensation handler metadata from a method
 * @param target - Target class
 * @param methodName - Method name
 */
export function getCompensationHandlerMetadata(
  target: any,
  methodName: string
): CompensationHandlerOptions | undefined {
  const methodMetadataKey = `saga:compensationHandler:${methodName}`;
  return Reflect.getMetadata(methodMetadataKey, target);
}

/**
 * @llm-summary get compensation handler methods function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * getCompensationHandlerMethods function implementing integration layer component for get compensation handler methods operations.
 *
 * @param {any} target - target parameter
 * @returns {Map<string, CompensationHandlerOptions>} Returns Map<string, CompensationHandlerOptions>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getCompensationHandlerMethods(target);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function getCompensationHandlerMethods(
  target: any
): Map<string, CompensationHandlerOptions> {
  const metadata: SagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target) || {};
  return metadata.compensationHandlers || new Map();
}

/**
 * @llm-summary is compensation handler method function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * isCompensationHandlerMethod function implementing integration layer component for is compensation handler method operations.
 *
 * @param {any} target - target parameter
 * @param {string} methodName - methodName parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isCompensationHandlerMethod(target, methodName);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function isCompensationHandlerMethod(target: any, methodName: string): boolean {
  const methodMetadataKey = `saga:compensationHandler:${methodName}`;
  return Reflect.hasMetadata(methodMetadataKey, target);
}

/**
 * @llm-summary get compensation handler for step function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * getCompensationHandlerForStep function implementing integration layer component for get compensation handler for step operations.
 *
 * @param {any} target - target parameter
 * @param {string} stepName - stepName parameter
 * @returns {|} Returns |
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getCompensationHandlerForStep(target, stepName);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function getCompensationHandlerForStep(
  target: any,
  stepName: string
):
  | {
      methodName: string;
      options: CompensationHandlerOptions;
    }
  | undefined {
  const compensationHandlers = getCompensationHandlerMethods(target);

  for (const [methodName, options] of compensationHandlers.entries()) {
    if (options.stepName === stepName) {
      return { methodName, options };
    }
  }

  return undefined;
}

/**
 * @llm-summary get ordered compensation handlers function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * getOrderedCompensationHandlers function implementing integration layer component for get ordered compensation handlers operations.
 *
 * @param {any} target - target parameter
 * @returns {Array<} Returns Array<
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getOrderedCompensationHandlers(target);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function getOrderedCompensationHandlers(target: any): Array<{
  methodName: string;
  options: CompensationHandlerOptions;
}> {
  const compensationHandlers = getCompensationHandlerMethods(target);

  const handlersArray = Array.from(compensationHandlers.entries()).map(([methodName, options]) => ({
    methodName,
    options,
  }));

  // Sort by order (lower numbers execute first)
  return handlersArray.sort((a, b) => (a.options.order || 0) - (b.options.order || 0));
}
