/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IValidationRule as ValidationRule, IValidator, ISpecification } from '@vytches-ddd/contracts';
import { Result } from '@vytches-ddd/utils';

import { ValidationError, ValidationErrors } from '../validation-error';

export class BusinessRuleValidator<T> implements IValidator<T> {
  private rules: ValidationRule<T>[] = [];
  private stopOnFirstFailure = false;
  private lastCondition: ((value: T) => boolean) | null = null;

  addRule(
    property: string,
    validationFn: (value: T) => boolean,
    message: string,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    this.rules.push({
      property,
      validate: (value: T) => {
        return validationFn(value)
          ? Result.ok(true)
          : Result.fail(new ValidationError(property, message, context));
      },
    });
    return this;
  }

  addSpecification(
    property: string,
    specification: ISpecification<T>,
    message: string,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    return this.addRule(
      property,
      (value) => specification.isSatisfiedBy(value),
      message,
      context,
    );
  }

  /**
   * Dodaje globalną specyfikację, która dotyczy całego obiektu
   */
  mustSatisfy(
    specification: ISpecification<T>,
    message: string,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    return this.addSpecification('', specification, message, context);
  }

  /**
   * Dodaje walidację dla konkretnej właściwości z użyciem specyfikacji
   */
  propertyMustSatisfy<P>(
    property: keyof T & string,
    specification: ISpecification<P>,
    message: string,
    getValue: (obj: T) => P,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    return this.addRule(
      property,
      (value) => specification.isSatisfiedBy(getValue(value)),
      message,
      context,
    );
  }

  /**
   * Dodaje walidację dla zagnieżdżonego obiektu
   */
  addNested<P>(
    property: string,
    validator: IValidator<P>,
    getValue: (obj: T) => P | undefined | null,
  ): BusinessRuleValidator<T> {
    this.rules.push({
      property,
      validate: (value: T) => {
        const propertyValue = getValue(value);

        // Obsługa przypadku, gdy zagnieżdżona wartość jest null/undefined
        if (propertyValue === undefined || propertyValue === null) {
          return Result.fail(
            new ValidationError(
              property,
              'Cannot validate undefined or null nested object',
              { path: property },
            ),
          );
        }

        const result = validator.validate(propertyValue);

        if (result.isFailure) {
          // Dodaje prefiks do nazw właściwości z zachowaniem pełnej ścieżki
          const prefixedErrors = result.error.errors.map((err) => {
            // Zachowaj oryginalny kontekst z dodatkową ścieżką
            const enrichedContext = {
              ...(err.context || {}),
              path: property + (err.property ? `.${err.property}` : ''),
              originalPath: err.property || '',
              parentPath: property,
            };

            return new ValidationError(
              `${property}${err.property ? `.${err.property}` : ''}`,
              err.message,
              enrichedContext,
            );
          });

          return Result.fail(
            new ValidationError(property, 'Nested validation failed', {
              errors: prefixedErrors,
              path: property,
              errorCount: prefixedErrors.length,
            }),
          );
        }

        return Result.ok(true);
      },
    });
    return this;
  }

  /**
   * Dodaje walidację warunkową
   */
  when(
    condition: (value: T) => boolean,
    thenValidator: (validator: BusinessRuleValidator<T>) => void,
  ): BusinessRuleValidator<T> {
    if (typeof condition !== 'function') {
      throw new Error('Condition must be a function');
    }

    this.lastCondition = condition;

    const conditionalValidator = new BusinessRuleValidator<T>();
    thenValidator(conditionalValidator);

    for (const rule of conditionalValidator.rules) {
      this.rules.push({
        ...rule,
        condition,
      });
    }

    return this;
  }

  /**
   * Dodaje walidację warunkową
   */
  otherwise(
    elseValidator: (validator: BusinessRuleValidator<T>) => void,
  ): BusinessRuleValidator<T> {
    if (this.lastCondition === null || this.lastCondition === undefined) {
      throw new Error(
        'Cannot call otherwise() without a preceding when() - lastCondition is null/undefined',
      );
    }

    if (typeof this.lastCondition !== 'function') {
      throw new Error(
        `Cannot call otherwise() - lastCondition is not a function but a ${typeof this.lastCondition}`,
      );
    }

    // Create a safe reference to the condition function
    const lastConditionFn = this.lastCondition;

    // Define negatedCondition using the reference to avoid 'this' binding issues
    const negatedCondition = (value: T) => !lastConditionFn(value);

    const elseConditionalValidator = new BusinessRuleValidator<T>();
    elseValidator(elseConditionalValidator);

    for (const rule of elseConditionalValidator.rules) {
      this.rules.push({
        ...rule,
        condition: negatedCondition,
      });
    }

    this.lastCondition = null;
    return this;
  }

  /**
   * Dodaje walidację warunkową opartą na specyfikacji
   */
  whenSatisfies(
    specification: ISpecification<T>,
    thenValidator: (validator: BusinessRuleValidator<T>) => void,
  ): BusinessRuleValidator<T> {
    return this.when(
      (value) => specification.isSatisfiedBy(value),
      thenValidator,
    );
  }

  /**
   * Konfiguruje walidator do zatrzymania po pierwszym błędzie
   */
  setStopOnFirstFailure(): BusinessRuleValidator<T> {
    this.stopOnFirstFailure = true;
    return this;
  }

  /**
   * Przeprowadza walidację
   */
  validate(value: T): Result<T, ValidationErrors> {
    const errors: ValidationError[] = [];

    for (const rule of this.rules) {
      // Sprawdza warunek, jeśli istnieje
      if (rule.condition && !rule.condition(value)) {
        continue;
      }

      const result = rule.validate(value);
      if (result.isFailure) {
        errors.push(result.error);

        if (this.stopOnFirstFailure) {
          break;
        }
      }
    }

    if (errors.length > 0) {
      return Result.fail(new ValidationErrors(errors));
    }

    return Result.ok(value);
  }

  /**
   * Łączy ten walidator z innym
   */
  and(other: IValidator<T>): BusinessRuleValidator<T> {
    const combined = new BusinessRuleValidator<T>();
    combined.rules = [...this.rules];

    combined.addRule(
      '',
      (value) => other.validate(value).isSuccess,
      'Failed combined validation',
    );

    return combined;
  }

  /**
   * Tworzy nowy walidator ze specyfikacji
   */
  static fromSpecification<T>(
    specification: ISpecification<T>,
    message: string,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    const validator = new BusinessRuleValidator<T>();
    return validator.mustSatisfy(specification, message, context);
  }

  static create<T>(): BusinessRuleValidator<T> {
    return new BusinessRuleValidator<T>();
  }
}
