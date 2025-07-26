import type { IValidator, IValidationErrors } from '@vytches/ddd-contracts';
import { Result } from '@vytches/ddd-utils';
import { ValidationError, ValidationErrors } from '../validation-error';

/**
 * @llm-summary BaseValidationAdapter class for base validation adapter operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * BaseValidationAdapter class implementing domain pattern implementation for base validation adapter operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseValidationAdapter();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseValidationAdapter());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseValidationAdapter<T, TSchema = unknown> implements IValidator<T> {
  constructor(protected readonly schema: TSchema) {}

  /**
   * Główna metoda walidacji - musi być zaimplementowana przez konkretne adaptery
   */
  abstract validate(value: T): Result<T, IValidationErrors>;

  /**
   * Helper method do tworzenia ValidationError z kontekstem
   */
  protected createValidationError(
    property: string,
    message: string,
    context?: Record<string, unknown>
  ): ValidationError {
    return new ValidationError(property, message, context);
  }

  /**
   * Helper method do tworzenia ValidationErrors z tablicy błędów
   */
  protected createValidationErrors(errors: ValidationError[]): ValidationErrors {
    return new ValidationErrors(errors);
  }

  /**
   * Helper method do konwersji ścieżki na string
   */
  protected pathToString(path: (string | number)[]): string {
    return path.join('.');
  }

  /**
   * Helper method do tworzenia Result.fail z błędami
   */
  protected failWithErrors(errors: ValidationError[]): Result<T, IValidationErrors> {
    return Result.fail(this.createValidationErrors(errors));
  }

  /**
   * Helper method do tworzenia Result.ok
   */
  protected success(value: T): Result<T, IValidationErrors> {
    return Result.ok(value);
  }
}

/**
 * @llm-summary Contract for error mapper functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * ErrorMapper interface implementing domain pattern implementation for error mapper operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteErrorMapper implements ErrorMapper {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ErrorMapper<TExternalError> {
  (error: TExternalError): ValidationError;
}

/**
 * @llm-summary AdapterUtils class for adapter utils operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AdapterUtils class implementing domain pattern implementation for adapter utils operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AdapterUtils();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AdapterUtils());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AdapterUtils {
  /**
   * Tworzy prosty adapter z funkcji walidacyjnej
   */
  static create<T>(
    validateFn: (value: T) => { success: boolean; errors?: string[] | undefined },
    errorProperty = ''
  ): IValidator<T> {
    return {
      validate: (value: T): Result<T, IValidationErrors> => {
        const result = validateFn(value);

        if (!result.success && result.errors) {
          const validationErrors = result.errors.map(
            message => new ValidationError(errorProperty, message)
          );
          return Result.fail(new ValidationErrors(validationErrors));
        }

        return Result.ok(value);
      },
    };
  }

  /**
   * Łączy wiele adapterów w jeden
   */
  static combine<T>(...adapters: IValidator<T>[]): IValidator<T> {
    return {
      validate: (value: T): Result<T, IValidationErrors> => {
        const allErrors: ValidationError[] = [];

        for (const adapter of adapters) {
          const result = adapter.validate(value);
          if (result.isFailure) {
            allErrors.push(...result.error.errors);
          }
        }

        if (allErrors.length > 0) {
          return Result.fail(new ValidationErrors(allErrors));
        }

        return Result.ok(value);
      },
    };
  }

  /**
   * Tworzy adapter z custom error mapping
   */
  static withErrorMapping<T, TError>(
    validateFn: (value: T) => { success: boolean; errors?: TError[] | undefined },
    errorMapper: ErrorMapper<TError>
  ): IValidator<T> {
    return {
      validate: (value: T): Result<T, IValidationErrors> => {
        const result = validateFn(value);

        if (!result.success && result.errors) {
          const validationErrors = result.errors.map(errorMapper);
          return Result.fail(new ValidationErrors(validationErrors));
        }

        return Result.ok(value);
      },
    };
  }
}
