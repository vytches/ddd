/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ISpecification } from '@vytches/ddd-contracts';

import {
  CompositeSpecification,
  AndSpecification,
  OrSpecification,
  NotSpecification,
} from './composite-specification';

/**
 * @llm-summary AlwaysTrueSpecification class for always true specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AlwaysTrueSpecification class implementing domain pattern implementation for always true specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AlwaysTrueSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AlwaysTrueSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AlwaysTrueSpecification<T> extends CompositeSpecification<T> {
  isSatisfiedBy(_candidate: T): boolean {
    return true;
  }
}

/**
 * @llm-summary AlwaysFalseSpecification class for always false specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AlwaysFalseSpecification class implementing domain pattern implementation for always false specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AlwaysFalseSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AlwaysFalseSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AlwaysFalseSpecification<T> extends CompositeSpecification<T> {
  isSatisfiedBy(_candidate: T): boolean {
    return false;
  }
}

/**
 * @llm-summary PredicateSpecification class for predicate specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PredicateSpecification class implementing domain pattern implementation for predicate specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PredicateSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PredicateSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PredicateSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

/**
 * @llm-summary PropertyEqualsSpecification class for property equals specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PropertyEqualsSpecification class implementing domain pattern implementation for property equals specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PropertyEqualsSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PropertyEqualsSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PropertyEqualsSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly expectedValue: T[keyof T]
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return candidate[this.propertyName] === this.expectedValue;
  }
}

/**
 * @llm-summary PropertyInSpecification class for property in specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PropertyInSpecification class implementing domain pattern implementation for property in specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PropertyInSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PropertyInSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PropertyInSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly possibleValues: T[keyof T][]
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.possibleValues.includes(candidate[this.propertyName]);
  }
}

/**
 * @llm-summary PropertyBetweenSpecification class for property between specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PropertyBetweenSpecification class implementing domain pattern implementation for property between specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PropertyBetweenSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PropertyBetweenSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PropertyBetweenSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly min: number,
    private readonly max: number
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    const value = candidate[this.propertyName] as unknown as number;
    return value >= this.min && value <= this.max;
  }
}

/**
 * @llm-summary Specification constant
 * @llm-domain Pattern
 *
 * @description
 * Specification constant implementing domain pattern implementation for specification operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(Specification);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const Specification = {
  /**
   * Tworzy specyfikację zawsze prawdziwą
   */
  alwaysTrue<T>(): ISpecification<T> {
    return new AlwaysTrueSpecification<T>();
  },

  /**
   * Tworzy specyfikację zawsze fałszywą
   */
  alwaysFalse<T>(): ISpecification<T> {
    return new AlwaysFalseSpecification<T>();
  },

  /**
   * Tworzy specyfikację opartą o predykat
   */
  create<T>(predicate: (candidate: T) => boolean): ISpecification<T> {
    return new PredicateSpecification<T>(predicate);
  },

  /**
   * Tworzy specyfikację sprawdzającą równość właściwości
   */
  propertyEquals<T>(propertyName: keyof T, expectedValue: T[keyof T]): ISpecification<T> {
    return new PropertyEqualsSpecification<T>(propertyName, expectedValue);
  },

  /**
   * Tworzy specyfikację sprawdzającą zawieranie się właściwości w zbiorze
   */
  propertyIn<T>(propertyName: keyof T, possibleValues: T[keyof T][]): ISpecification<T> {
    return new PropertyInSpecification<T>(propertyName, possibleValues);
  },

  /**
   * Tworzy specyfikację sprawdzającą zakres wartości
   */
  propertyBetween<T>(propertyName: keyof T, min: number, max: number): ISpecification<T> {
    return new PropertyBetweenSpecification<T>(propertyName, min, max);
  },

  /**
   * Łączy specyfikacje operatorem AND
   */
  and<T>(...specifications: ISpecification<T>[]): ISpecification<T> {
    if (specifications.length === 0) return new AlwaysTrueSpecification<T>();

    let result = specifications[0]!;
    for (let i = 1; i < specifications.length; i++) {
      result = new AndSpecification<T>(result, specifications[i]!);
    }

    return result;
  },

  /**
   * Łączy specyfikacje operatorem OR
   */
  or<T>(...specifications: ISpecification<T>[]): ISpecification<T> {
    if (specifications.length === 0) return new AlwaysFalseSpecification<T>();

    let result = specifications[0]!;
    for (let i = 1; i < specifications.length; i++) {
      result = new OrSpecification<T>(result, specifications[i]!);
    }

    return result;
  },

  /**
   * Neguje specyfikację
   */
  not<T>(specification: ISpecification<T>): ISpecification<T> {
    return new NotSpecification<T>(specification);
  },
};
