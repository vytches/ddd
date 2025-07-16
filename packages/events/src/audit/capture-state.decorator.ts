/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ISpecification } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';
import type { IAuditable } from './audible.interface';

/**
 * @llm-summary capture state function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * captureState function implementing architectural component for capture state operations.
 *
 *
 * @param {ISpecification<T> | ((instance: T} conditionOrSpecification? - conditionOrSpecification? parameter
 * @param {any[]} args - args parameter
 * @returns {MethodDecorator} Returns MethodDecorator
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = captureState(conditionOrSpecification?, args);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => captureState(conditionOrSpecification?, args));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function captureState<T extends IAuditable>(
  conditionOrSpecification?: ISpecification<T> | ((instance: T, args: any[]) => boolean)
): MethodDecorator {
  const logger = Logger.create('CaptureStateDecorator');

  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]): any {
      if (!('saveSnapshot' in this)) {
        logger.warn(
          `Class ${this.constructor.name} doesn't properly implement IAuditable interface. @captureState decorator has no effect.`
        );
        return originalMethod.apply(this, args);
      }

      let shouldCapture = true;

      // If condition is provided, evaluate it
      if (conditionOrSpecification) {
        if (typeof conditionOrSpecification === 'function') {
          // It's a function
          shouldCapture = conditionOrSpecification(this as T, args);
        } else {
          // It's a specification
          shouldCapture = conditionOrSpecification.isSatisfiedBy(this as T);
        }
      }

      // Capture state if condition is met
      if (shouldCapture) {
        (this as IAuditable).saveSnapshot();
      }

      // Execute the original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
