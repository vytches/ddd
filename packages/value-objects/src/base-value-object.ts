/**
 * @llm-summary Contract for value object validator functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ValueObjectValidator interface implementing core domain functionality for value object validator operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValueObjectValidator implements ValueObjectValidator {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ValueObjectValidator<T> {
  validate(value: T): boolean;
}

/**
 * @llm-summary BaseValueObject class for base value object operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * BaseValueObject class implementing core domain functionality for base value object operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseValueObject();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export abstract class BaseValueObject<T> implements ValueObjectValidator<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param valueObject The value object to compare with
   * @returns True if they are equal, false otherwise
   * @example-inject
   */
  equals(valueObject: BaseValueObject<T>): boolean {
    if (!valueObject) {
      return false;
    }

    return this.value === valueObject.value;
  }

  /**
   * Returns a string representation of the value object
   * @returns String representation
   */
  toString(): string {
    return String(this.value);
  }

  /**
   * Returns a default JSON representation of the value object
   * @returns JSON representation
   */
  toJSON(): string {
    return JSON.stringify(this.value);
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns The underlying value
   * @example-inject
   */
  getValue(): T {
    return this.value;
  }

  /**
   * Abstract method to validate the value
   * @param value The value to validate
   * @returns True if valid, false otherwise
   */
  abstract validate(value: unknown): boolean;
}
