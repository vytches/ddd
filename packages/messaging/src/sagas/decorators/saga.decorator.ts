import 'reflect-metadata';
import type { Constructor } from '@vytches-ddd/di';
import type { SagaDecoratorOptions, SagaMetadata } from '../interfaces';
import { SagaConfigurationError } from '../errors';

// Metadata keys for saga decorators
export const SAGA_METADATA_KEY = Symbol('saga:metadata');
export const SAGA_TYPE_METADATA_KEY = Symbol('saga:type');

/**
 * Saga decorator - marks a class as a saga definition
 * Integrates with VytchesDDD dependency injection system
 *
 * @param options - Saga configuration options
 */
export function Saga(options: SagaDecoratorOptions): <T extends Constructor>(target: T) => T;
export function Saga(sagaType: string): <T extends Constructor>(target: T) => T;
export function Saga(
  optionsOrType: SagaDecoratorOptions | string
): <T extends Constructor>(target: T) => T {
  return function <T extends Constructor>(target: T): T {
    // Normalize options
    const options: SagaDecoratorOptions =
      typeof optionsOrType === 'string' ? { sagaType: optionsOrType } : optionsOrType;

    // Validate required options
    if (!options.sagaType || options.sagaType.trim() === '') {
      throw new SagaConfigurationError(
        'unknown',
        '@Saga decorator requires a sagaType',
        ['sagaType is required'],
        { usage: "@Saga('OrderProcessingSaga')" }
      );
    }

    // Set default values
    const sagaOptions: SagaDecoratorOptions = {
      sagaType: options.sagaType,
      displayName: options.displayName || options.sagaType,
      description: options.description || '',
      defaultTimeout: options.defaultTimeout || 3600000, // 1 hour default
      ...(options.maxInstances !== undefined && { maxInstances: options.maxInstances }),
      startEvents: options.startEvents || [],
      autoRegister: options.autoRegister !== false, // Default to true
      lifetime: options.lifetime || 'transient',
      ...(options.context !== undefined && { context: options.context }),
    };

    // Get existing metadata or create new
    const existingMetadata: SagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target) || {};

    // Update metadata
    const updatedMetadata: SagaMetadata = {
      ...existingMetadata,
      saga: sagaOptions,
    };

    // Store metadata
    Reflect.defineMetadata(SAGA_METADATA_KEY, updatedMetadata, target);
    Reflect.defineMetadata(SAGA_TYPE_METADATA_KEY, sagaOptions.sagaType, target);

    // Register with DI system if auto-registration is enabled
    if (sagaOptions.autoRegister) {
      // Import DI registration at runtime to avoid circular dependencies
      setTimeout(() => {
        try {
          // This allows for lazy loading of DI system
          const { VytchesDDD } = require('@vytches-ddd/di');
          if (VytchesDDD && typeof VytchesDDD.registerService === 'function') {
            VytchesDDD.registerService({
              serviceId: `saga:${sagaOptions.sagaType}`,
              implementation: target,
              lifetime: sagaOptions.lifetime,
              context: sagaOptions.context,
              metadata: {
                type: 'saga',
                ...sagaOptions,
              },
            });
          }
        } catch (error) {
          // DI system not available - this is fine, manual registration can be used
          console.debug(
            `Saga auto-registration skipped for ${sagaOptions.sagaType}: DI system not available`
          );
        }
      }, 0);
    }

    return target;
  };
}

/**
 * Get saga metadata from a class
 * @param target - Target class
 */
export function getSagaMetadata(target: Constructor): SagaMetadata | undefined {
  return Reflect.getMetadata(SAGA_METADATA_KEY, target);
}

/**
 * Get saga type from a class
 * @param target - Target class
 */
export function getSagaType(target: Constructor): string | undefined {
  return Reflect.getMetadata(SAGA_TYPE_METADATA_KEY, target);
}

/**
 * Check if a class is decorated with @Saga
 * @param target - Target class
 */
export function isSagaClass(target: Constructor): boolean {
  return Reflect.hasMetadata(SAGA_METADATA_KEY, target);
}

/**
 * Get all saga types from metadata
 * @param target - Target class
 */
export function getAllSagaTypes(targets: Constructor[]): string[] {
  return targets.filter(isSagaClass).map(getSagaType).filter(Boolean) as string[];
}
