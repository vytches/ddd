import { BaseValueObject } from '@vytches/ddd-value-objects';

interface MoneyProps {
  readonly amount: number;
  readonly currency: string;
}

export class Money extends BaseValueObject<MoneyProps> {
  static create(amount: number, currency: string): Money {
    const vo = new Money({ amount, currency });
    if (!vo.validate({ amount, currency })) {
      throw new Error(`Invalid money: amount=${amount}, currency=${currency}`);
    }
    return vo;
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
