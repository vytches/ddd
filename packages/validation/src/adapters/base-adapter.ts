import type { IValidator, IValidationErrors } from '@vytches-ddd/contracts';
import { Result } from '@vytches-ddd/utils';
import { ValidationError, ValidationErrors } from '../validation-error';

/**
 * Bazowa klasa abstrakcyjna dla adapterów zewnętrznych bibliotek walidacji
 * Zapewnia wspólny interfejs i utility methods dla różnych bibliotek
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
 * Interface dla funkcji mapującej błędy z zewnętrznej biblioteki
 */
export interface ErrorMapper<TExternalError> {
  (error: TExternalError): ValidationError;
}

/**
 * Utility class z helper functions dla tworzenia adapterów
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
