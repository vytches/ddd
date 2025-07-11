import 'reflect-metadata';
import type { CompensationHandlerOptions, SagaMetadata } from '../interfaces';
import { SAGA_METADATA_KEY } from './saga.decorator';
import { SagaConfigurationError } from '../errors';

/**
 * Compensation handler decorator - marks a method as a compensation handler
 * Provides declarative compensation logic for saga steps
 *
 * @param options - Compensation handler configuration
 */
export function CompensationHandler(options: CompensationHandlerOptions): MethodDecorator;
export function CompensationHandler(stepName: string): MethodDecorator;
export function CompensationHandler(
  optionsOrStepName: CompensationHandlerOptions | string
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Normalize options
    const options: CompensationHandlerOptions = typeof optionsOrStepName === 'string'
      ? { stepName: optionsOrStepName }
      : optionsOrStepName;

    // Validate required options
    if (!options.stepName || options.stepName.trim() === '') {
      throw new SagaConfigurationError(
        'unknown',
        '@CompensationHandler decorator requires stepName',
        ['stepName is required'],
        { usage: '@CompensationHandler(\'processPayment\')' }
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
    const existingMetadata: SagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target.constructor) || {};

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
export function getCompensationHandlerMetadata(target: any, methodName: string): CompensationHandlerOptions | undefined {
  const methodMetadataKey = `saga:compensationHandler:${methodName}`;
  return Reflect.getMetadata(methodMetadataKey, target);
}

/**
 * Get all compensation handler methods from a class
 * @param target - Target class
 */
export function getCompensationHandlerMethods(target: any): Map<string, CompensationHandlerOptions> {
  const metadata: SagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target) || {};
  return metadata.compensationHandlers || new Map();
}

/**
 * Check if a method is decorated with @CompensationHandler
 * @param target - Target class
 * @param methodName - Method name
 */
export function isCompensationHandlerMethod(target: any, methodName: string): boolean {
  const methodMetadataKey = `saga:compensationHandler:${methodName}`;
  return Reflect.hasMetadata(methodMetadataKey, target);
}

/**
 * Get compensation handler for a specific step
 * @param target - Target class
 * @param stepName - Step name to find compensation handler for
 */
export function getCompensationHandlerForStep(target: any, stepName: string): {
  methodName: string;
  options: CompensationHandlerOptions;
} | undefined {
  const compensationHandlers = getCompensationHandlerMethods(target);

  for (const [methodName, options] of compensationHandlers.entries()) {
    if (options.stepName === stepName) {
      return { methodName, options };
    }
  }

  return undefined;
}

/**
 * Get all compensation handlers sorted by execution order
 * @param target - Target class
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
