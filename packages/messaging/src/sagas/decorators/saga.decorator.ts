import 'reflect-metadata';
import type { Constructor } from '@vytches/ddd-di';
import type { SagaDecoratorOptions, SagaMetadata } from '../interfaces';
import { SagaConfigurationError } from '../errors';

// Metadata keys for saga decorators

/**
 * @llm-summary SAGA_METADATA_KEY constant
 * @llm-domain Integration
 *
 * @description
 * SAGA_METADATA_KEY constant implementing integration layer component for s a g a_ m e t a d a t a_ k e y operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(SAGA_METADATA_KEY);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const SAGA_METADATA_KEY = Symbol('saga:metadata');

/**
 * @llm-summary SAGA_TYPE_METADATA_KEY constant
 * @llm-domain Integration
 *
 * @description
 * SAGA_TYPE_METADATA_KEY constant implementing integration layer component for s a g a_ t y p e_ m e t a d a t a_ k e y operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(SAGA_TYPE_METADATA_KEY);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const SAGA_TYPE_METADATA_KEY = Symbol('saga:type');

/**
 * @llm-summary saga function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * Saga function implementing integration layer component for saga operations.
 *
 * @param {SagaDecoratorOptions} options - options parameter
 * @returns {<T extends Constructor>(target: T) => T} Returns <T extends Constructor>(target: T) => T
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = Saga(options);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function Saga(options: SagaDecoratorOptions): <T extends Constructor>(target: T) => T;

/**
 * @llm-summary saga function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * Saga function implementing integration layer component for saga operations.
 *
 * @param {string} sagaType - sagaType parameter
 * @returns {<T extends Constructor>(target: T) => T} Returns <T extends Constructor>(target: T) => T
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = Saga(sagaType);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function Saga(sagaType: string): <T extends Constructor>(target: T) => T;

/**
 * @llm-summary saga function
 * @llm-domain Integration
 * @llm-pure false
 *
 * @description
 * Saga function implementing integration layer component for saga operations.
 *
 * @param {SagaDecoratorOptions | string} optionsOrType - optionsOrType parameter
 * @returns {<T extends Constructor>(target: T) => T} Returns <T extends Constructor>(target: T) => T
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = Saga(optionsOrType);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
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
          const { VytchesDDD } = require('@vytches/ddd-di');
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
 * @llm-summary is saga class function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * isSagaClass function implementing integration layer component for is saga class operations.
 *
 * @param {Constructor} target - target parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isSagaClass(target);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function isSagaClass(target: Constructor): boolean {
  return Reflect.hasMetadata(SAGA_METADATA_KEY, target);
}

/**
 * @llm-summary get all saga types function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * getAllSagaTypes function implementing integration layer component for get all saga types operations.
 *
 * @param {Constructor[]} targets - targets parameter
 * @returns {string[]} Returns string[]
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getAllSagaTypes(targets);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function getAllSagaTypes(targets: Constructor[]): string[] {
  return targets.filter(isSagaClass).map(getSagaType).filter(Boolean) as string[];
}
