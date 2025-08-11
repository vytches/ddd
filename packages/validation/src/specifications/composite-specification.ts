import type { ISpecification } from '@vytches/ddd-contracts';

export abstract class CompositeSpecification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification<T>(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification<T>(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification<T>(this);
  }

  static create<T>(predicate: (candidate: T) => boolean): ISpecification<T> {
    return new PredicateSpecification<T>(predicate);
  }
}

class PredicateSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

export class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

export class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

export class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}
