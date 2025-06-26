import type { ISpecification } from '@vytches-ddd/contracts';
import { Result } from '@vytches-ddd/utils';

import { CompositeSpecification as Specification } from '../specifications/composite-specification';
import { ValidationErrors, ValidationError } from '../validation-error';
import { BusinessRuleValidator } from './business-rule-validator';

/**
 * Extension for BusinessRuleValidator with additional specification integration
 */
export class BusinessRuleValidatorExtension<T> {
  constructor(private validator: BusinessRuleValidator<T>) {}

  /**
   * Converts the validator to a specification
   */
  toSpecification(
    _errorMessage = 'Validation failed',
  ): ISpecification<T> {
    return Specification.create<T>(
      (candidate) => this.validator.validate(candidate).isSuccess,
    );
  }

  /**
   * Validates an object using additional specifications
   */
  validateWithSpecifications(
    value: T,
    ...specs: ISpecification<T>[]
  ): Result<T, ValidationErrors> {
    const allErrors: ValidationError[] = [];

    // First validate with the rules of this validator
    const validatorResult = this.validator.validate(value);
    if (validatorResult.isFailure) {
      allErrors.push(...validatorResult.error.errors);
    }

    for (const spec of specs) {
      if (!spec.isSatisfiedBy(value)) {
        allErrors.push(
          new ValidationError(
            '', // No specific property
            'Object does not satisfy specification',
            { specification: spec },
          ),
        );
      }
    }

    if (allErrors.length > 0) {
      return Result.fail(new ValidationErrors(allErrors));
    }

    return Result.ok(value);
  }
}

// Extend the BusinessRuleValidator prototype with new methods
declare module './business-rule-validator' {
  interface BusinessRuleValidator<T> {
    /**
     * Converts this validator to a specification
     */
    toSpecification(errorMessage?: string): ISpecification<T>;

    /**
     * Validates value with additional specifications
     */
    validateWithSpecifications(
      value: T,
      ...specs: ISpecification<T>[]
    ): Result<T, ValidationErrors>;

    apply(
      rule: (validator: BusinessRuleValidator<T>) => BusinessRuleValidator<T>,
    ): BusinessRuleValidator<T>;
  }
}

// Implementacja metody apply
BusinessRuleValidator.prototype.apply = function <T>(
  this: BusinessRuleValidator<T>,
  rule: (validator: BusinessRuleValidator<T>) => BusinessRuleValidator<T>,
): BusinessRuleValidator<T> {
  return rule(this);
};

// Implement the extension methods
BusinessRuleValidator.prototype.toSpecification = function <T>(
  this: BusinessRuleValidator<T>,
  errorMessage = 'Validation failed',
): ISpecification<T> {
  const extension = new BusinessRuleValidatorExtension(this);
  return extension.toSpecification(errorMessage);
};

BusinessRuleValidator.prototype.validateWithSpecifications = function <T>(
  this: BusinessRuleValidator<T>,
  value: T,
  ...specs: ISpecification<T>[]
): Result<T, ValidationErrors> {
  const extension = new BusinessRuleValidatorExtension(this);
  return extension.validateWithSpecifications(value, ...specs);
};
