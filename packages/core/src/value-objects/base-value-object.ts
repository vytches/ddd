export interface ValueObjectValidator<T> {
  validate(value: T): boolean;
}

export abstract class BaseValueObject<T> implements ValueObjectValidator<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Compares two value objects for equality
   * @param valueObject The value object to compare with
   * @returns True if they are equal, false otherwise
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
   * Returns VO value as string
   * @returns JSON representation
   */
  getValue(): T {
    return this.value;
  }

  /**
   * Abstract method to validate the value
   * @param value The value to validate
   * @returns True if valid, false otherwise
   */
  abstract validate(value: any): boolean;
}
