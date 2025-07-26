import type { IValidator, ISpecification, IValidationErrors } from '@vytches/ddd-contracts';
import { Result } from '@vytches/ddd-utils';

import { ValidationError, ValidationErrors } from './validation-error';
import { SpecificationValidator } from './specifications/specification-validator';
import { BusinessRuleValidator } from './business-rules/business-rule-validator';
import { CompositeSpecification as Specification } from './specifications/composite-specification';

/**
 * @llm-summary Validation constant
 * @llm-domain Pattern
 *
 * @description
 * Validation constant implementing domain pattern implementation for validation operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(Validation);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const Validation = {
  /**
   * Tworzy nowy walidator reguł biznesowych
   */
  create<T>(): BusinessRuleValidator<T> {
    return BusinessRuleValidator.create<T>();
  },

  /**
   * Tworzy walidator oparty na specyfikacji
   */
  fromSpecification<T>(
    specification: ISpecification<T>,
    message: string,
    property?: string
  ): IValidator<T> {
    return SpecificationValidator.fromSpecification(specification, message, property);
  },

  /**
   * Tworzy walidator łączący wiele walidatorów
   */
  combine<T>(...validators: IValidator<T>[]): IValidator<T> {
    return {
      validate: (value: T): Result<T, IValidationErrors> => {
        const errors: IValidationErrors[] = [];

        for (const validator of validators) {
          const result = validator.validate(value);
          if (result.isFailure) {
            errors.push(result.error);
          }
        }

        if (errors.length > 0) {
          // Łączymy wszystkie błędy
          const allErrors = errors.flatMap(e => e.errors);
          return Result.fail(new ValidationErrors(allErrors as ValidationError[]));
        }

        return Result.ok(value);
      },
    };
  },

  /**
   * Waliduje obiekt bezpośrednio za pomocą specyfikacji
   */
  validateWithSpecification<T>(
    value: T,
    specification: ISpecification<T>,
    message: string
  ): Result<T, IValidationErrors> {
    return this.fromSpecification(specification, message).validate(value);
  },

  /**
   * Waliduje za pomocą wielu specyfikacji z własnymi komunikatami błędów
   */
  validateWithRules<T>(
    value: T,
    rules: Array<{
      specification: ISpecification<T>;
      message: string;
      property?: string;
    }>
  ): Result<T, ValidationErrors> {
    const validator = SpecificationValidator.create<T>();

    for (const rule of rules) {
      validator.addRule(rule.specification, rule.message, rule.property);
    }

    return validator.validate(value);
  },

  // Narzędzia konwersji

  /**
   * Konwertuje specyfikację na walidator
   */
  specificationToValidator<T>(
    specification: ISpecification<T>,
    message: string,
    property?: string
  ): IValidator<T> {
    return this.fromSpecification(specification, message, property);
  },

  /**
   * Konwertuje walidator na specyfikację
   */
  validatorToSpecification<T>(validator: IValidator<T>): ISpecification<T> {
    return Specification.create<T>(candidate => validator.validate(candidate).isSuccess);
  },

  /**
   * Tworzy walidator dla głęboko zagnieżdżonej struktury obiektów
   */
  forNestedPath<T>(path: string[], validator: IValidator<unknown>): IValidator<T> {
    if (path.length === 0) {
      return validator as unknown as IValidator<T>;
    }

    let currentValidator = validator;

    // Budowanie walidatorów od najgłębszego poziomu
    for (let i = path.length - 1; i >= 0; i--) {
      const property = path[i];
      const nestedValidator = BusinessRuleValidator.create();

      nestedValidator.addNested(property as string, currentValidator, obj => {
        return obj ? obj[property as keyof typeof obj] : undefined;
      });

      currentValidator = nestedValidator;
    }

    return currentValidator as unknown as IValidator<T>;
  },

  /**
   * Waliduje głęboko zagnieżdżoną właściwość
   */
  validatePath<T, P>(
    object: T,
    path: (string | number)[],
    valueValidator: IValidator<P>
  ): Result<T, ValidationErrors> {
    // Funkcja pomocnicza do pobierania wartości po ścieżce
    const getValueByPath = (obj: unknown, pathSegments: (string | number)[]): unknown => {
      let current: unknown = obj;

      for (const segment of pathSegments) {
        if (current === null || current === undefined) {
          return undefined;
        }

        if (typeof current === 'object' && current !== null) {
          current = (current as Record<string | number, unknown>)[segment];
        } else {
          return undefined;
        }
      }

      return current;
    };

    const pathValue = getValueByPath(object, path);

    if (pathValue === undefined) {
      return Result.fail(
        new ValidationErrors([new ValidationError(path.join('.'), 'Path does not exist', { path })])
      );
    }

    const valueResult = valueValidator.validate(pathValue as P);

    if (valueResult.isFailure) {
      // Przekształć błędy, dodając ścieżkę
      const prefixedErrors = valueResult.error.errors.map(err => {
        const fullPath = [...path];
        if (err.property) {
          fullPath.push(err.property);
        }

        return new ValidationError(fullPath.join('.'), err.message, {
          ...err.context,
          fullPath,
        });
      });

      return Result.fail(new ValidationErrors(prefixedErrors));
    }

    return Result.ok(object);
  },

  /**
   * Używa zewnętrznego walidatora implementującego IValidator<T>
   * Pozwala na integrację z bibliotekami takimi jak zod, class-validator, itp.
   */
  useExternal<T>(validator: IValidator<T>): IValidator<T> {
    return validator;
  },
};
