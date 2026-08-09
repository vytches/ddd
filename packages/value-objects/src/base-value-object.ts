import { LibUtils } from '@vytches/ddd-utils';

export interface ValueObjectValidator<T> {
  validate(value: T): boolean;
}

/**
 * VF-036 (D3): module-private brand used to recognize "this is a
 * `BaseValueObject`" without `instanceof`. `instanceof` breaks silently
 * across duplicate package copies (e.g. a failed `pnpm dedupe`, or two
 * versions of this library resolved by a bundler/monorepo tool) because
 * each copy has its own distinct class reference. `Symbol.for` reads from
 * the *global* symbol registry, so every copy of this module — regardless
 * of which physical `node_modules` install produced it — resolves the same
 * symbol and agrees on the brand. The symbol is intentionally not exported:
 * consumers never need to reference it directly, only the boolean brand
 * check performed internally by `componentEquals`.
 */
const VALUE_OBJECT_BRAND: unique symbol = Symbol.for('@vytches/ddd.valueObject');

/**
 * VF-036 (D3): element-level equality used when comparing
 * `getIdentityComponents()` arrays. If both `a` and `b` carry the
 * `BaseValueObject` brand, delegate to `a.equals(b)` so nested value
 * objects are compared by their own identity/equality rules (which may
 * themselves be component-based) rather than by structural inspection of
 * their internal `value`. Otherwise falls through to
 * `LibUtils.deepEqual`, which receives a brand-new `WeakMap` for cycle
 * tracking on every call — sharing one `WeakMap` across sibling elements
 * would incorrectly treat an object reused across two different
 * components as a cycle.
 */
function componentEquals(a: unknown, b: unknown): boolean {
  if (
    typeof a === 'object' &&
    a !== null &&
    VALUE_OBJECT_BRAND in a &&
    typeof b === 'object' &&
    b !== null &&
    VALUE_OBJECT_BRAND in b
  ) {
    return (a as unknown as BaseValueObject<unknown>).equals(
      b as unknown as BaseValueObject<unknown>
    );
  }

  return LibUtils.deepEqual(a, b, new WeakMap());
}

export abstract class BaseValueObject<T> implements ValueObjectValidator<T> {
  protected readonly value: T;

  /**
   * VF-036 (D3): marks every instance with the module-private brand symbol
   * so `componentEquals` can recognize nested value objects without
   * `instanceof`. Declared as an instance property (not on the prototype)
   * so `in` works uniformly regardless of how a subclass is constructed.
   */
  protected readonly [VALUE_OBJECT_BRAND] = true;

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
   * VF-036 (D1/D4): opt-in hook letting a subclass declare which fields
   * make up its *identity*, so `equals()` compares those fields instead of
   * the raw `value` this class stores. Ships under the name
   * `getIdentityComponents` — an earlier, never-implemented name for a
   * similar idea (`getEqualityComponents`) circulated in docs and MUST NOT
   * be revived as an alias, shim, or runtime-detected fallback; it never
   * existed in source and never will.
   *
   * ## When component identity beats full-value equality
   * The default raw comparison (`this.value === valueObject.value`, then
   * `LibUtils.deepEqual` for objects) treats the *entire* stored value as
   * significant. Override this hook when only a subset of fields should
   * participate — e.g. a `Money` VO whose `value` also carries a
   * display-formatting flag that must not affect equality, or a VO that
   * wants to compare by a derived/normalized projection of its state
   * rather than the raw stored shape.
   *
   * ## The asymmetric fallback, and why it is not transitive
   * The dispatch rule in `equals()` is: if BOTH sides return a defined
   * array, compare components; if EITHER side returns `undefined`, run the
   * completely unchanged raw comparison. This rule is symmetric (`a.equals(b)`
   * and `b.equals(a)` agree, since both directions see the same two
   * `getIdentityComponents()` results) but deliberately **not transitive**:
   * given A (raw comparison, no override), B (component override, happens
   * to have the same raw `value` as A), and C (component override, same
   * components as B), `A.equals(B)` may be `true` (raw fallback matches),
   * `B.equals(C)` may be `true` (components match), yet `A.equals(C)` can
   * be `false` (raw fallback, different `value`). This is an accepted,
   * documented, test-pinned limitation — do not "fix" it by adding
   * type/instanceof gating; see D6. It matters most for collection code
   * such as `list.some(x => x.equals(y))` or de-duplication by `.equals`:
   * such code implicitly assumes an equivalence relation, and mixing
   * component-identity subclasses with raw-comparison subclasses in the
   * same collection breaks that assumption.
   *
   * ## The empty-array footgun
   * Returning `[]` is **defined-and-empty**, not "opt out". An empty array
   * means "this VO has no identity-relevant fields", so it is equal to
   * every other VO whose `getIdentityComponents()` also returns `[]`
   * (same length: zero, vacuously equal element-wise) — regardless of what
   * their respective `value`s hold. To opt out, return `undefined` (the
   * base default), not `[]`.
   *
   * ## The undefined-because-field-not-initialized trap
   * `undefined` silently downgrades to the raw comparison. If an override
   * reads a subclass field that has not been initialized yet (see the
   * undefined-during-`super()` trap documented on the constructor) and
   * that read produces `undefined` as a *component value* (not as the
   * hook's own return value), the surrounding array is still "defined" —
   * only a *literal* `undefined`/omitted return from the override itself
   * triggers the fallback. Conversely, a conditional override that
   * sometimes returns `undefined` (e.g. "only compare by components once
   * some field is set") will silently and intermittently fall back to raw
   * comparison for the same class — prefer always returning an array once
   * a class opts in.
   *
   * ## Throw propagation
   * A throwing override propagates out of `equals()` uncaught (D5).
   * `equals()` is a hot path and this library's logger is
   * diagnostics-only, so there is no try/catch here — catching would
   * silently convert a loud consumer bug (e.g. a component accessor that
   * dereferences something absent) into a wrong-but-quiet `false`/`true`
   * answer. `equals()` stops being a total function for classes that
   * override this hook with logic that can throw.
   *
   * ## Fixed arity
   * A class must always return the same number of components on every
   * call (do not vary the array length based on instance state). Two
   * defined arrays of different lengths are treated as unequal without
   * inspecting elements, so a class whose arity drifts will get
   * inconsistent, order-of-comparison-dependent results.
   *
   * ## Components must come from frozen/readonly state
   * The constructor deep-freezes the `value` passed to `super()`, but it
   * does **not** freeze any additional fields a subclass declares and
   * assigns after `super(value)` — those are ordinary mutable class
   * fields unless the subclass itself makes them readonly/frozen.
   * Components must be derived only from state that cannot change after
   * construction (the frozen `value`, or subclass fields the subclass
   * itself keeps immutable); deriving a component from mutable state
   * breaks the invariant that a VO's equality is stable for its lifetime.
   *
   * ## Type-scoped equality: the sanctioned idiom
   * This hook performs no type or `instanceof` check (D6) — cross-subclass
   * equality behaves exactly as it does today, and two different
   * subclasses returning matching components are considered equal. For
   * consumers who want type-scoped equality, the sanctioned opt-in is a
   * string literal as the first component (e.g. `['Money', this.amount,
   * this.currency]`), NOT `this.constructor.name` (unsafe under
   * minification, which can rename classes inconsistently) and NOT the
   * class object itself (unsafe across duplicate package copies, the same
   * hazard `instanceof` has — see the brand-symbol note above).
   *
   * ## toString()/toJSON() stay value-based
   * Overriding this hook does not change `toString()` or `toJSON()` — both
   * continue to reflect the raw `value`. If an override narrows equality
   * to a subset of fields, `toString()`/`toJSON()` may now serialize
   * information that equality ignores (or vice versa); keeping any
   * resulting equals/hash/serialization desync coherent is the
   * consumer's responsibility.
   *
   * @returns `undefined` (the base default) to opt out and keep the raw
   *   `value`-based comparison; a readonly array of identity-relevant
   *   values to opt in to component-wise comparison.
   */
  protected getIdentityComponents(): readonly unknown[] | undefined {
    return undefined;
  }

  /**
   * Compares this value object with another for equality.
   *
   * VF-036 (D1/D2): first consults `getIdentityComponents()` on both
   * sides. If BOTH return a defined array, equality is decided by that
   * array alone: same length, then element-wise via `componentEquals`
   * (which itself dispatches to nested `.equals()` for branded value
   * objects, `LibUtils.deepEqual` otherwise). If EITHER side returns
   * `undefined`, this method falls through to the exact, unmodified raw
   * comparison that existed before VF-036 — see the block below and the
   * `getIdentityComponents` doc comment for the full rationale, including
   * why this fallback is symmetric but not transitive.
   *
   * The hook is consulted for primitive `T` as well as object `T`; nothing
   * about this dispatch depends on `typeof this.value`.
   *
   * HARD CONSTRAINT: there is intentionally no unconditional
   * `this === valueObject` shortcut at the top of this method — the only
   * reflexivity shortcut this class takes lives inside the raw-comparison
   * branch below (`this.value === valueObject.value`, which briefly
   * predates any `getIdentityComponents` check on that branch only because
   * neither side opted in). When neither side returns components, the
   * executed code path is bit-for-bit identical to the pre-VF-036
   * behavior, which is what keeps this a non-breaking, additive minor
   * release rather than a breaking major.
   *
   * Uses deep structural comparison for object values, === for primitives,
   * in the fallback branch.
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

    const ownComponents = this.getIdentityComponents();
    const otherComponents = valueObject.getIdentityComponents();

    if (ownComponents !== undefined && otherComponents !== undefined) {
      if (ownComponents.length !== otherComponents.length) {
        return false;
      }

      for (let i = 0; i < ownComponents.length; i++) {
        if (!componentEquals(ownComponents[i], otherComponents[i])) {
          return false;
        }
      }

      return true;
    }

    // Unchanged raw comparison (pre-VF-036 behavior, bit-for-bit) — reached
    // whenever either side opts out of getIdentityComponents().
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
