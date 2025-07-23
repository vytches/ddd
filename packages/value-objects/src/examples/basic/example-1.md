# Money Value Object - Basic Example

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Basic
**Domain**: Financial Domain
**Patterns**: Value Object, Immutability, Currency Handling
**Dependencies**: @vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating a **Money** value object that encapsulates amount and currency with immutability, validation, and arithmetic operations. Shows basic value object principles including equality comparison, validation, and formatted display.

## Business Context

Money is a fundamental value object in financial applications. It ensures currency consistency, prevents precision errors with decimal arithmetic, and provides type safety for monetary calculations. Essential for e-commerce, banking, accounting, and any application handling financial transactions.

## Code Example

```typescript
// money.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import { MoneyData, Currency, ValueObjectValidationResult } from './types';
import { 
  validateRequired, 
  validateNumericRange, 
  getCurrency, 
  formatCurrency,
  createSuccessResult,
  createFailureResult,
  combineValidationResults
} from '../shared';

export class Money extends ValueObject<MoneyData> {
  private constructor(data: MoneyData) {
    super(data);
  }

  // ✅ FOCUS: Factory method with validation
  static create(amount: number, currencyCode: string, precision?: number): Money {
    const currency = getCurrency(currencyCode);
    if (!currency) {
      throw new Error(`Unsupported currency: ${currencyCode}`);
    }

    const data: MoneyData = {
      amount: Number(amount.toFixed(currency.decimalPlaces)),
      currency: currencyCode.toUpperCase(),
      precision: precision ?? currency.decimalPlaces
    };

    const validation = Money.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid money data: ${validation.errors.join(', ')}`);
    }

    return new Money(data);
  }

  // ✅ FOCUS: Comprehensive validation
  static validate(data: MoneyData): ValueObjectValidationResult {
    const amountValidation = validateRequired(data.amount, 'amount');
    const currencyValidation = validateRequired(data.currency, 'currency');
    const rangeValidation = validateNumericRange(data.amount, -999999999, 999999999, 'amount');
    
    // Validate currency exists
    const currency = getCurrency(data.currency);
    const currencyExistsResult = currency 
      ? createSuccessResult()
      : createFailureResult([`Currency '${data.currency}' is not supported`]);

    return combineValidationResults(
      amountValidation,
      currencyValidation, 
      rangeValidation,
      currencyExistsResult
    );
  }

  // ✅ FOCUS: Arithmetic operations returning new instances
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    const newAmount = this.data.amount + other.data.amount;
    return Money.create(newAmount, this.data.currency, this.data.precision);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    const newAmount = this.data.amount - other.data.amount;
    return Money.create(newAmount, this.data.currency, this.data.precision);
  }

  multiply(multiplier: number): Money {
    const newAmount = this.data.amount * multiplier;
    return Money.create(newAmount, this.data.currency, this.data.precision);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide money by zero');
    }
    const newAmount = this.data.amount / divisor;
    return Money.create(newAmount, this.data.currency, this.data.precision);
  }

  // ✅ FOCUS: Comparison operations
  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.data.amount > other.data.amount;
  }

  isLessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.data.amount < other.data.amount;
  }

  isEqualTo(other: Money): boolean {
    return this.data.currency === other.data.currency && 
           this.data.amount === other.data.amount;
  }

  isZero(): boolean {
    return this.data.amount === 0;
  }

  isPositive(): boolean {
    return this.data.amount > 0;
  }

  isNegative(): boolean {
    return this.data.amount < 0;
  }

  // ✅ FOCUS: Utility methods
  abs(): Money {
    return Money.create(Math.abs(this.data.amount), this.data.currency, this.data.precision);
  }

  negate(): Money {
    return Money.create(-this.data.amount, this.data.currency, this.data.precision);
  }

  // ✅ FOCUS: Display and serialization
  toString(): string {
    const currency = getCurrency(this.data.currency)!;
    return formatCurrency(this.data.amount, currency);
  }

  toDisplayString(locale: string = 'en-US'): string {
    const currency = getCurrency(this.data.currency)!;
    return formatCurrency(this.data.amount, currency, locale);
  }

  // ✅ FOCUS: Getters
  get amount(): number {
    return this.data.amount;
  }

  get currency(): string {
    return this.data.currency;
  }

  get precision(): number {
    return this.data.precision!;
  }

  // Private helper methods
  private ensureSameCurrency(other: Money): void {
    if (this.data.currency !== other.data.currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this.data.currency} and ${other.data.currency}`
      );
    }
  }

  // ✅ FOCUS: Value object equality implementation
  protected isEqualTo(other: Money): boolean {
    return this.data.currency === other.data.currency && 
           this.data.amount === other.data.amount &&
           this.data.precision === other.data.precision;
  }
}
```

## Usage Examples

```typescript
// basic-money-usage.ts
import { Money } from './money';

// ✅ Creating money instances
const price = Money.create(29.99, 'USD');
const discount = Money.create(5.00, 'USD');
const tax = Money.create(2.40, 'USD');

console.log(price.toString()); // "$29.99"

// ✅ Arithmetic operations
const subtotal = price.subtract(discount);  // $24.99
const total = subtotal.add(tax);            // $27.39
const halfPrice = price.divide(2);          // $14.995

console.log(`Subtotal: ${subtotal}`);      // "Subtotal: $24.99"
console.log(`Total: ${total}`);            // "Total: $27.39"

// ✅ Comparisons
const minOrder = Money.create(25.00, 'USD');
const canProceed = total.isGreaterThan(minOrder); // true

if (canProceed) {
  console.log('Order meets minimum requirement');
}

// ✅ Validation example
try {
  const invalid = Money.create(-1, 'INVALID_CURRENCY');
} catch (error) {
  console.error(error.message); // "Unsupported currency: INVALID_CURRENCY"
}

// ✅ Different currencies
const euroPrice = Money.create(24.99, 'EUR');
const yenPrice = Money.create(2999, 'JPY');

console.log(euroPrice.toString());  // "€24.99"  
console.log(yenPrice.toString());   // "¥2,999"

// Error handling for different currencies
try {
  const invalid = price.add(euroPrice);  // Throws error
} catch (error) {
  console.error(error.message); // "Cannot operate on different currencies: USD and EUR"
}
```

## Advanced Usage

```typescript
// advanced-money-operations.ts
import { Money } from './money';

// ✅ Complex calculations
function calculateOrderTotal(
  items: Array<{ price: Money; quantity: number; taxRate: number }>
): Money {
  let total = Money.create(0, 'USD');
  
  for (const item of items) {
    const lineTotal = item.price.multiply(item.quantity);
    const taxAmount = lineTotal.multiply(item.taxRate);
    const lineWithTax = lineTotal.add(taxAmount);
    
    total = total.add(lineWithTax);
  }
  
  return total;
}

// ✅ Money allocation (splitting)
function splitBill(total: Money, numberOfPeople: number): Money[] {
  const baseAmount = total.divide(numberOfPeople);
  const remainder = Money.create(
    total.amount - (baseAmount.amount * numberOfPeople),
    total.currency
  );
  
  const splits: Money[] = [];
  
  // Distribute base amount to everyone
  for (let i = 0; i < numberOfPeople; i++) {
    splits.push(baseAmount);
  }
  
  // Add remainder to first person
  if (!remainder.isZero()) {
    splits[0] = splits[0].add(remainder);
  }
  
  return splits;
}

// Usage examples
const orderItems = [
  { price: Money.create(15.99, 'USD'), quantity: 2, taxRate: 0.08 },
  { price: Money.create(8.50, 'USD'), quantity: 1, taxRate: 0.08 },
  { price: Money.create(12.25, 'USD'), quantity: 3, taxRate: 0.08 }
];

const orderTotal = calculateOrderTotal(orderItems);
console.log(`Order total: ${orderTotal}`); // "Order total: $95.00"

const billSplit = splitBill(orderTotal, 4);
billSplit.forEach((amount, index) => {
  console.log(`Person ${index + 1}: ${amount}`);
});
```

## Key Features

- **Immutability**: All operations return new Money instances
- **Currency Safety**: Prevents operations between different currencies  
- **Precision Handling**: Respects currency-specific decimal places
- **Comprehensive Validation**: Validates amount, currency, and precision
- **Rich Operations**: Arithmetic, comparison, and utility operations
- **Formatted Display**: Locale-aware currency formatting
- **Type Safety**: Strongly typed with TypeScript support

## Common Pitfalls

- **Floating Point Precision**: Always use currency-appropriate decimal places
- **Currency Mixing**: Validate same currency before operations
- **Null/Undefined Values**: Always validate inputs in factory methods
- **Zero Division**: Handle division by zero in divide operations
- **Large Numbers**: Consider precision limits for very large amounts

## Related Examples

- [Email Value Object](./example-2.md) - String-based value object with validation
- [Address Value Object](./example-3.md) - Complex composite value object