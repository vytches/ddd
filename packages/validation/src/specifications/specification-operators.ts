/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ISpecification } from '@vytches-ddd/contracts';

import {
  CompositeSpecification,
  AndSpecification,
  OrSpecification,
  NotSpecification,
} from './composite-specification';

/**
 * Specyfikacja spełniona zawsze
 */
export class AlwaysTrueSpecification<T> extends CompositeSpecification<T> {
  isSatisfiedBy(_candidate: T): boolean {
    return true;
  }
}

/**
 * Specyfikacja niespełniona nigdy
 */
export class AlwaysFalseSpecification<T> extends CompositeSpecification<T> {
  isSatisfiedBy(_candidate: T): boolean {
    return false;
  }
}

/**
 * Specyfikacja oparta o funkcję predykatu
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
 * Specyfikacja sprawdzająca właściwość obiektu pod kątem równości
 */
export class PropertyEqualsSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly expectedValue: any
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return candidate[this.propertyName] === this.expectedValue;
  }
}

/**
 * Specyfikacja sprawdzająca czy właściwość obiektu zawiera się w zbiorze wartości
 */
export class PropertyInSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly possibleValues: any[]
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.possibleValues.includes(candidate[this.propertyName]);
  }
}

/**
 * Specyfikacja sprawdzająca zakres wartości właściwości obiektu
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
 * Pomocnicze funkcje do tworzenia specyfikacji
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
  propertyEquals<T>(propertyName: keyof T, expectedValue: any): ISpecification<T> {
    return new PropertyEqualsSpecification<T>(propertyName, expectedValue);
  },

  /**
   * Tworzy specyfikację sprawdzającą zawieranie się właściwości w zbiorze
   */
  propertyIn<T>(propertyName: keyof T, possibleValues: any[]): ISpecification<T> {
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
