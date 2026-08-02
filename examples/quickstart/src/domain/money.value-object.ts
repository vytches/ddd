import { BaseValueObject } from '@vytches/ddd-value-objects';

interface MoneyProps {
  readonly amount: number;
  readonly currency: string;
}

export class Money extends BaseValueObject<MoneyProps> {
  static create(amount: number, currency: string): Money {
    // VF-023 (D-1): BaseValueObject's constructor now calls validate() and
    // throws automatically, so no separate post-construction check is
    // needed here. The custom "Invalid money: ..." message is supplied via
    // the getInvalidValueMessage() hook below.
    return new Money({ amount, currency });
  }

  static zero(currency: string): Money {
    return Money.create(0, currency);
  }

  validate(value: unknown): boolean {
    const props = value as MoneyProps;
    return (
      typeof props.amount === 'number' &&
      props.amount >= 0 &&
      typeof props.currency === 'string' &&
      props.currency.length === 3
    );
  }

  // VF-023 (D-1 regression fix): the base constructor throws synchronously
  // BEFORE this class's constructor body would run, so the previous
  // pattern of constructing then manually checking validate() and throwing
  // a custom-message Error is unreachable. Override this hook instead to
  // preserve the custom message.
  protected override getInvalidValueMessage(value: MoneyProps): string {
    return `Invalid money: amount=${value.amount}, currency=${value.currency}`;
  }

  get amount(): number {
    return this.getValue().amount;
  }

  get currency(): string {
    return this.getValue().currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add different currencies: ${this.currency} + ${other.currency}`);
    }
    return Money.create(this.amount + other.amount, this.currency);
  }
}
