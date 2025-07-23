# Basic Value Objects - Implementation Overview

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Basic
**Focus**: Implementation patterns and best practices

## Overview

This document provides comprehensive guidance for implementing basic value objects using the @vytches-ddd/value-objects package. It covers fundamental patterns, common implementations, and best practices for creating robust value objects.

## Core Implementation Pattern

### **Base Value Object Structure**

```typescript
import { ValueObject } from '@vytches-ddd/value-objects';
import { ValueObjectValidationResult } from './types';

// ✅ Standard value object implementation pattern
export class BasicValueObject extends ValueObject<DataType> {
  // Private constructor enforces factory pattern
  private constructor(data: DataType) {
    super(data);
  }

  // ✅ Factory method with validation
  static create(/* parameters */): BasicValueObject {
    const data: DataType = {
      // Normalize and prepare data
    };

    const validation = BasicValueObject.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid data: ${validation.errors.join(', ')}`);
    }

    return new BasicValueObject(data);
  }

  // ✅ Comprehensive validation
  static validate(data: DataType): ValueObjectValidationResult {
    // Implement validation logic
    return { isValid: true, errors: [] };
  }

  // ✅ Business operations (returning new instances)
  someOperation(): BasicValueObject {
    // Transform data and return new instance
    return new BasicValueObject(transformedData);
  }

  // ✅ Getters for data access
  get someProperty(): SomeType {
    return this.data.someProperty;
  }

  // ✅ Display methods
  toString(): string {
    return 'formatted representation';
  }

  // ✅ Equality implementation
  protected isEqualTo(other: BasicValueObject): boolean {
    return this.data.property === other.data.property;
  }
}
```

## Implementation Guidelines

### **1. Factory Pattern**

Always use factory methods instead of public constructors:

```typescript
export class Temperature extends ValueObject<TemperatureData> {
  private constructor(data: TemperatureData) {
    super(data);
  }

  // ✅ Primary factory method
  static celsius(value: number): Temperature {
    return Temperature.create(value, 'celsius');
  }

  // ✅ Alternative factory methods
  static fahrenheit(value: number): Temperature {
    return Temperature.create(value, 'fahrenheit');
  }

  static kelvin(value: number): Temperature {
    return Temperature.create(value, 'kelvin');
  }

  // ✅ Generic factory with validation
  private static create(value: number, unit: TemperatureUnit): Temperature {
    const data: TemperatureData = { value, unit };
    
    if (!Temperature.isValidTemperature(data)) {
      throw new Error(`Invalid temperature: ${value}°${unit}`);
    }

    return new Temperature(data);
  }

  private static isValidTemperature(data: TemperatureData): boolean {
    // Validate against absolute zero for each unit
    const absoluteZero = {
      celsius: -273.15,
      fahrenheit: -459.67,
      kelvin: 0
    };
    
    return data.value >= absoluteZero[data.unit];
  }
}
```

### **2. Immutability and Operations**

All operations must return new instances:

```typescript
export class Percentage extends ValueObject<PercentageData> {
  private constructor(data: PercentageData) {
    super(data);
  }

  static create(value: number): Percentage {
    if (value < 0 || value > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    
    return new Percentage({ value });
  }

  // ✅ Operations return new instances
  add(other: Percentage): Percentage {
    const newValue = Math.min(100, this.data.value + other.data.value);
    return Percentage.create(newValue);
  }

  subtract(other: Percentage): Percentage {
    const newValue = Math.max(0, this.data.value - other.data.value);
    return Percentage.create(newValue);
  }

  multiply(factor: number): Percentage {
    const newValue = Math.min(100, this.data.value * factor);
    return Percentage.create(newValue);
  }

  // ✅ Comparison operations
  isGreaterThan(other: Percentage): boolean {
    return this.data.value > other.data.value;
  }

  // ✅ Utility methods
  asDecimal(): number {
    return this.data.value / 100;
  }

  toString(): string {
    return `${this.data.value}%`;
  }
}
```

### **3. Comprehensive Validation**

Implement thorough validation with clear error messages:

```typescript
import { 
  validateRequired, 
  validateStringLength, 
  validateNumericRange,
  combineValidationResults 
} from '../shared';

export class ProductCode extends ValueObject<ProductCodeData> {
  private constructor(data: ProductCodeData) {
    super(data);
  }

  static create(code: string): ProductCode {
    const normalizedCode = code.trim().toUpperCase();
    const data: ProductCodeData = { code: normalizedCode };

    const validation = ProductCode.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid product code: ${validation.errors.join(', ')}`);
    }

    return new ProductCode(data);
  }

  // ✅ Multi-layered validation
  static validate(data: ProductCodeData): ValueObjectValidationResult {
    const validations = [
      // Required field validation
      validateRequired(data.code, 'product code'),
      
      // Length validation
      validateStringLength(data.code, 3, 20, 'product code'),
      
      // Format validation
      ProductCode.validateFormat(data.code),
      
      // Business rule validation
      ProductCode.validateBusinessRules(data.code)
    ];

    return combineValidationResults(...validations);
  }

  private static validateFormat(code: string): ValueObjectValidationResult {
    // Must contain only alphanumeric characters and hyphens
    const formatRegex = /^[A-Z0-9-]+$/;
    
    if (!formatRegex.test(code)) {
      return {
        isValid: false,
        errors: ['Product code must contain only letters, numbers, and hyphens']
      };
    }

    return { isValid: true, errors: [] };
  }

  private static validateBusinessRules(code: string): ValueObjectValidationResult {
    const errors: string[] = [];

    // Cannot start or end with hyphen
    if (code.startsWith('-') || code.endsWith('-')) {
      errors.push('Product code cannot start or end with hyphen');
    }

    // Cannot have consecutive hyphens
    if (code.includes('--')) {
      errors.push('Product code cannot contain consecutive hyphens');
    }

    // Must contain at least one letter
    if (!/[A-Z]/.test(code)) {
      errors.push('Product code must contain at least one letter');
    }

    return errors.length > 0 
      ? { isValid: false, errors }
      : { isValid: true, errors: [] };
  }

  // ✅ Business methods
  getCategory(): string {
    // Extract category from first 3 characters
    return this.data.code.substring(0, 3);
  }

  getSequenceNumber(): string | null {
    // Extract sequence number if present
    const match = this.data.code.match(/-(\d+)$/);
    return match ? match[1] : null;
  }

  isLegacyFormat(): boolean {
    // Check if follows old format (e.g., starts with 'LEG')
    return this.data.code.startsWith('LEG-');
  }

  toString(): string {
    return this.data.code;
  }

  protected isEqualTo(other: ProductCode): boolean {
    return this.data.code === other.data.code;
  }
}
```

### **4. Type Safety and Generics**

Use TypeScript effectively for type safety:

```typescript
// ✅ Generic identifier value object
export class Identifier<T extends string = string> extends ValueObject<{ value: T }> {
  private constructor(data: { value: T }) {
    super(data);
  }

  static create<T extends string>(value: T): Identifier<T> {
    if (!value || value.trim().length === 0) {
      throw new Error('Identifier cannot be empty');
    }

    return new Identifier({ value: value.trim() as T });
  }

  get value(): T {
    return this.data.value;
  }

  toString(): string {
    return this.data.value;
  }

  protected isEqualTo(other: Identifier<T>): boolean {
    return this.data.value === other.data.value;
  }
}

// ✅ Specific typed identifiers
export type UserId = Identifier<`user-${string}`>;
export type ProductId = Identifier<`product-${string}`>;
export type OrderId = Identifier<`order-${string}`>;

// Factory functions for specific types
export const UserId = {
  create: (value: string): UserId => {
    if (!value.startsWith('user-')) {
      throw new Error('User ID must start with "user-"');
    }
    return Identifier.create(value as `user-${string}`);
  },
  
  generate: (): UserId => {
    const id = `user-${Math.random().toString(36).substring(2, 15)}`;
    return Identifier.create(id as `user-${string}`);
  }
};
```

### **5. Display and Formatting**

Provide multiple representation formats:

```typescript
export class Duration extends ValueObject<DurationData> {
  private constructor(data: DurationData) {
    super(data);
  }

  static minutes(value: number): Duration {
    return new Duration({ totalMinutes: value });
  }

  static hours(value: number): Duration {
    return new Duration({ totalMinutes: value * 60 });
  }

  static days(value: number): Duration {
    return new Duration({ totalMinutes: value * 24 * 60 });
  }

  // ✅ Multiple display formats
  toString(): string {
    return this.toHumanReadable();
  }

  toHumanReadable(): string {
    const totalMinutes = this.data.totalMinutes;
    
    if (totalMinutes < 60) {
      return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
    }
    
    if (totalMinutes < 24 * 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) {
        result += ` ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
      
      return result;
    }
    
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingHours = Math.floor((totalMinutes % (24 * 60)) / 60);
    
    let result = `${days} day${days !== 1 ? 's' : ''}`;
    if (remainingHours > 0) {
      result += ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    
    return result;
  }

  toISO8601(): string {
    const totalMinutes = this.data.totalMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `PT${hours}H${minutes}M`;
  }

  toCompactString(): string {
    const totalMinutes = this.data.totalMinutes;
    
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  // ✅ Getters for different units
  get totalMinutes(): number {
    return this.data.totalMinutes;
  }

  get totalHours(): number {
    return this.data.totalMinutes / 60;
  }

  get totalDays(): number {
    return this.data.totalMinutes / (24 * 60);
  }
}
```

## Common Implementation Patterns

### **1. Enumerated Value Objects**

```typescript
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export class TaskPriority extends ValueObject<{ level: Priority; numericValue: number }> {
  private static readonly PRIORITY_VALUES: Record<Priority, number> = {
    low: 1,
    medium: 2, 
    high: 3,
    critical: 4
  };

  private constructor(data: { level: Priority; numericValue: number }) {
    super(data);
  }

  static low(): TaskPriority {
    return new TaskPriority({ level: 'low', numericValue: 1 });
  }

  static medium(): TaskPriority {
    return new TaskPriority({ level: 'medium', numericValue: 2 });
  }

  static high(): TaskPriority {
    return new TaskPriority({ level: 'high', numericValue: 3 });
  }

  static critical(): TaskPriority {
    return new TaskPriority({ level: 'critical', numericValue: 4 });
  }

  static fromString(priority: string): TaskPriority {
    const normalizedPriority = priority.toLowerCase() as Priority;
    
    if (!TaskPriority.PRIORITY_VALUES[normalizedPriority]) {
      throw new Error(`Invalid priority: ${priority}`);
    }

    switch (normalizedPriority) {
      case 'low': return TaskPriority.low();
      case 'medium': return TaskPriority.medium();
      case 'high': return TaskPriority.high();
      case 'critical': return TaskPriority.critical();
    }
  }

  isHigherThan(other: TaskPriority): boolean {
    return this.data.numericValue > other.data.numericValue;
  }

  get level(): Priority {
    return this.data.level;
  }

  toString(): string {
    return this.data.level;
  }
}
```

### **2. Composite Value Objects**

```typescript
export class FullName extends ValueObject<PersonNameData> {
  private constructor(data: PersonNameData) {
    super(data);
  }

  static create(
    firstName: string,
    lastName: string,
    middleName?: string,
    title?: string,
    suffix?: string
  ): FullName {
    const data: PersonNameData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName?.trim(),
      title: title?.trim(),
      suffix: suffix?.trim()
    };

    if (!data.firstName || !data.lastName) {
      throw new Error('First name and last name are required');
    }

    return new FullName(data);
  }

  // ✅ Multiple formatting options
  getDisplayName(format: 'formal' | 'casual' | 'last-first' = 'casual'): string {
    switch (format) {
      case 'formal':
        return this.getFormalName();
      case 'last-first':
        return this.getLastFirstName();
      case 'casual':
      default:
        return this.getCasualName();
    }
  }

  private getFormalName(): string {
    const parts = [];
    
    if (this.data.title) parts.push(this.data.title);
    parts.push(this.data.firstName);
    if (this.data.middleName) parts.push(this.data.middleName);
    parts.push(this.data.lastName);
    if (this.data.suffix) parts.push(this.data.suffix);
    
    return parts.join(' ');
  }

  private getCasualName(): string {
    const parts = [this.data.firstName];
    if (this.data.middleName) parts.push(this.data.middleName);
    parts.push(this.data.lastName);
    
    return parts.join(' ');
  }

  private getLastFirstName(): string {
    const parts = [this.data.lastName + ',', this.data.firstName];
    if (this.data.middleName) parts.push(this.data.middleName);
    
    return parts.join(' ');
  }

  getInitials(): string {
    let initials = this.data.firstName.charAt(0);
    
    if (this.data.middleName) {
      initials += this.data.middleName.charAt(0);
    }
    
    initials += this.data.lastName.charAt(0);
    
    return initials.toUpperCase();
  }

  // ✅ Getters
  get firstName(): string { return this.data.firstName; }
  get lastName(): string { return this.data.lastName; }
  get middleName(): string | undefined { return this.data.middleName; }
  get title(): string | undefined { return this.data.title; }
  get suffix(): string | undefined { return this.data.suffix; }

  toString(): string {
    return this.getDisplayName();
  }
}
```

## Error Handling Best Practices

### **1. Descriptive Error Messages**

```typescript
export class CreditCardNumber extends ValueObject<{ number: string; brand: CardBrand }> {
  private constructor(data: { number: string; brand: CardBrand }) {
    super(data);
  }

  static create(number: string): CreditCardNumber {
    const cleanNumber = number.replace(/[\s-]/g, '');
    
    // ✅ Specific validation errors
    if (cleanNumber.length === 0) {
      throw new Error('Credit card number cannot be empty');
    }

    if (!/^\d+$/.test(cleanNumber)) {
      throw new Error('Credit card number must contain only digits');
    }

    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      throw new Error('Credit card number must be between 13 and 19 digits');
    }

    if (!CreditCardNumber.passesLuhnCheck(cleanNumber)) {
      throw new Error('Credit card number is not valid (fails Luhn algorithm check)');
    }

    const brand = CreditCardNumber.detectBrand(cleanNumber);
    if (!brand) {
      throw new Error('Credit card number format is not recognized');
    }

    return new CreditCardNumber({ number: cleanNumber, brand });
  }

  private static passesLuhnCheck(number: string): boolean {
    let sum = 0;
    let isEven = false;

    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private static detectBrand(number: string): CardBrand | null {
    if (number.startsWith('4')) return 'visa';
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard';
    if (number.startsWith('34') || number.startsWith('37')) return 'amex';
    if (number.startsWith('6011')) return 'discover';
    
    return null;
  }
}
```

## Testing Value Objects

### **Test Structure Example**

```typescript
// value-object.test.ts
import { Money } from './money';
import { safeRun } from '@vytches-ddd/utils';

describe('Money Value Object', () => {
  describe('creation', () => {
    it('should create valid money instance', () => {
      const [error, money] = safeRun(() => Money.create(29.99, 'USD'));
      
      expect(error).toBeNull();
      expect(money?.amount).toBe(29.99);
      expect(money?.currency).toBe('USD');
    });

    it('should throw error for invalid currency', () => {
      const [error] = safeRun(() => Money.create(10, 'INVALID'));
      
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Unsupported currency');
    });
  });

  describe('operations', () => {
    it('should add money correctly', () => {
      const money1 = Money.create(10.00, 'USD');
      const money2 = Money.create(5.00, 'USD');
      
      const result = money1.add(money2);
      
      expect(result.amount).toBe(15.00);
      expect(result.currency).toBe('USD');
    });

    it('should prevent operations on different currencies', () => {
      const usd = Money.create(10, 'USD');
      const eur = Money.create(10, 'EUR');
      
      const [error] = safeRun(() => usd.add(eur));
      
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('different currencies');
    });
  });

  describe('equality', () => {
    it('should be equal for same amount and currency', () => {
      const money1 = Money.create(10.50, 'USD');
      const money2 = Money.create(10.50, 'USD');
      
      expect(money1.equals(money2)).toBe(true);
    });

    it('should not be equal for different currencies', () => {
      const money1 = Money.create(10, 'USD');
      const money2 = Money.create(10, 'EUR');
      
      expect(money1.equals(money2)).toBe(false);
    });
  });
});
```

## Summary

Basic value object implementations should focus on:

1. **Factory Pattern**: Private constructors with static factory methods
2. **Comprehensive Validation**: Multiple layers of validation with clear errors
3. **Immutability**: All operations return new instances
4. **Type Safety**: Leverage TypeScript for compile-time safety
5. **Multiple Representations**: Various display and formatting options
6. **Business Logic**: Encode domain rules directly in the value objects
7. **Error Handling**: Descriptive error messages for validation failures
8. **Testing**: Comprehensive test coverage including error cases

These patterns provide a solid foundation for implementing robust value objects that serve as building blocks for more complex domain logic.