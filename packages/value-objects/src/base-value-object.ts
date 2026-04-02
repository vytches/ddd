export interface ValueObjectValidator<T> {
  validate(value: T): boolean;
}

export abstract class BaseValueObject<T> implements ValueObjectValidator<T> {
  protected readonly value: T;

  constructor(value: T) {
    // Deep freeze for object values to enforce immutability
    if (value !== null && typeof value === 'object') {
      this.value = Object.freeze(value) as T;
    } else {
      this.value = value;
    }
  }

  /**
   * Compares this value object with another for equality.
   * Uses deep structural comparison for object values, === for primitives.
   * @param valueObject - The value object to compare with
   * @returns True if they are equal, false otherwise
   */
  equals(valueObject: BaseValueObject<T>): boolean {
    if (!valueObject) {
      return false;
    }

    if (this.value === valueObject.value) {
      return true;
    }

    // Deep comparison for object values
    if (typeof this.value === 'object' && this.value !== null) {
      return JSON.stringify(this.value) === JSON.stringify(valueObject.value);
    }

    return false;
  }

  /**
   * Returns a string representation of the value object
   * @returns String representation
   */
  toString(): string {
    return String(this.value);
  }

  /**
   * Returns the value for JSON serialization.
   * Returns T (not string) so JSON.stringify works correctly without double-encoding.
   */
  toJSON(): unknown {
    return this.value;
  }

  /**
   * Gets the underlying value as a readonly reference.
   * @returns The underlying value (frozen for object types)
   */
  getValue(): Readonly<T> {
    return this.value;
  }

  /**
   * Abstract method to validate the value
   * @param value The value to validate
   * @returns True if valid, false otherwise
   */
  abstract validate(value: unknown): boolean;
}
