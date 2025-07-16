/* eslint-disable @typescript-eslint/no-explicit-any */
import { Result } from '@vytches-ddd/utils';
import type { IValidator, ISpecification } from '@vytches-ddd/contracts';

import { ValidationError, ValidationErrors } from '../validation-error';

/**
 * @llm-summary SpecificationValidator class for specification validator operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * SpecificationValidator class implementing domain pattern implementation for specification validator operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SpecificationValidator();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SpecificationValidator());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SpecificationValidator<T> implements IValidator<T> {
  private validationRules: Array<{
    specification: ISpecification<T>;
    message: string;
    property?: string;
    context?: Record<string, any>;
  }> = [];

  /**
   * Adds a validation rule based on a specification
   */
  addRule(
    specification: ISpecification<T>,
    message: string,
    property?: string,
    context?: Record<string, unknown>
  ): SpecificationValidator<T> {
    const rule: {
      specification: ISpecification<T>;
      message: string;
      property: string;
      context?: Record<string, unknown>;
    } = {
      specification,
      message,
      property: property || '',
    };

    if (context !== undefined) {
      rule.context = context;
    }

    this.validationRules.push(rule);
    return this;
  }

  /**
   * Adds a rule for a specific object property
   */
  addPropertyRule<P>(
    property: keyof T & string,
    specification: ISpecification<P>,
    message: string,
    getValue: (obj: T) => P,
    context?: Record<string, any>
  ): SpecificationValidator<T> {
    // Create a specification adapter for the property
    const propertySpec: ISpecification<T> = {
      isSatisfiedBy: (candidate: T) => specification.isSatisfiedBy(getValue(candidate)),
      // The following methods are not used in this context but must be implemented
      and: () => {
        throw new Error('Operation not supported');
      },
      or: () => {
        throw new Error('Operation not supported');
      },
      not: () => {
        throw new Error('Operation not supported');
      },
    };

    return this.addRule(propertySpec, message, property, context);
  }

  /**
   * Performs validation based on all specifications
   */
  validate(value: T): Result<T, ValidationErrors> {
    const errors: ValidationError[] = [];

    for (const rule of this.validationRules) {
      if (!rule.specification.isSatisfiedBy(value)) {
        errors.push(new ValidationError(rule.property || '', rule.message, rule.context));
      }
    }

    if (errors.length > 0) {
      return Result.fail(new ValidationErrors(errors));
    }

    return Result.ok(value);
  }

  /**
   * Creates a validator with a single rule
   */
  static fromSpecification<T>(
    specification: ISpecification<T>,
    message: string,
    property?: string,
    context?: Record<string, any>
  ): SpecificationValidator<T> {
    return new SpecificationValidator<T>().addRule(specification, message, property, context);
  }

  /**
   * Creates an empty validator
   */
  static create<T>(): SpecificationValidator<T> {
    return new SpecificationValidator<T>();
  }
}
