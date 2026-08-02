import { LibUtils } from '@vytches/ddd-utils';

export interface ValueObjectValidator<T> {
  validate(value: T): boolean;
}

export abstract class BaseValueObject<T> implements ValueObjectValidator<T> {
  protected readonly value: T;

  /**
   * VF-023 (D-1, AC1, BREAKING): validates `value` via the polymorphic
   * `validate()` hook and throws synchronously on failure. This replaces
   * the previous convention where every subclass repeated
   * `if (!this.validate(value)) throw ...` in its own constructor after
   * `super(value)` — that boilerplate is now centralized here and enforced
   * for ALL subclasses, including any that previously forgot it.
   *
   * MIGRATION NOTE (undefined-during-super() trap): `validate()` is called
   * via prototype dispatch from *this* base constructor, i.e. before the
   * subclass constructor body (and therefore any subclass field
   * initializers declared after `super(value)`) has run. A `validate()`
   * override that reads `this.someOtherField` set up elsewhere in the
   * subclass constructor will see `undefined` for that field. Overrides
   * must only depend on the `value` parameter passed in, not on
   * subclass instance state. Existing subclasses that already call
   * `this.validate(value)` redundantly after `super(value)` are
   * unaffected — the base class throws first, before that redundant call
   * is ever reached.
   */
  constructor(value: T) {
    // Deep freeze for object values to enforce immutability (VF-023 D-3,
    // BREAKING: previously a shallow Object.freeze, nested objects/arrays
    // were still mutable).
    this.value = value !== null && typeof value === 'object' ? LibUtils.deepFreeze(value) : value;

    if (!this.validate(this.value)) {
      throw new Error(this.getInvalidValueMessage(this.value));
    }
  }

  /**
   * Compares this value object with another for equality.
   * Uses deep structural comparison for object values, === for primitives.
   *
   * VF-023 (D-3, AC2/AC3, BREAKING): deep comparison now uses
   * `LibUtils.deepEqual` instead of `JSON.stringify` equality. This fixes
   * false negatives/positives inherent to JSON-based comparison — key
   * order sensitivity is gone (already true before, since JSON.stringify
   * of plain objects is insertion-order, not truly key-order-independent
   * in all engines), values like `undefined`, `Date`, `Map`, `Set`, and
   * `NaN` inside nested structures now compare by actual value semantics
   * instead of silently dropping (`undefined`) or losing type
   * (`Date`/`Map`/`Set` stringify to structurally different, sometimes
   * colliding, JSON shapes).
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
      return LibUtils.deepEqual(this.value, valueObject.value);
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

  /**
   * VF-023 (D-1 regression fix): produces the message used when the
   * constructor's synchronous `validate()` call fails. Because the base
   * constructor now throws BEFORE the subclass constructor body runs (see
   * the class-level doc comment), a subclass can no longer rely on its own
   * post-`super(value)` `throw new Error('...')` — that code is
   * unreachable, since the base class has already thrown by the time
   * control would return to the subclass. Override this hook instead to
   * provide a validation-error message specific to the subclass. Only
   * `value` (the parameter, not subclass instance state — see the
   * undefined-during-super() trap note above) is safe to use here.
   * @param value The value that failed validation
   * @returns The message to use for the thrown `Error`
   */
  protected getInvalidValueMessage(value: T): string {
    void value;
    return `Invalid value for ${this.constructor.name}`;
  }
}
