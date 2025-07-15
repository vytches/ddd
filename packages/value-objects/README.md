# @vytches-ddd/value-objects

<!-- LLM-METADATA
Package: @vytches-ddd/value-objects
Category: Foundation
Purpose: Common value object implementations including EntityId, Money, Email, and other domain value objects
Dependencies: @vytches-ddd/domain-primitives, @vytches-ddd/contracts
Complexity: Medium
DDD Patterns: Value Object, Entity Identifier, Domain Primitive
Integration Points: Used by all domain models and aggregates
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fvalue-objects.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fvalue-objects)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Common value object implementations for Domain-Driven Design**

Collection of battle-tested value objects including EntityId, Money, Email, Address, and other common domain primitives. Built with validation, immutability, and rich behavior patterns.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [EntityId](#entityid)
- [Money](#money)
- [Email](#email)
- [Address](#address)
- [PhoneNumber](#phonenumber)
- [DateRange](#daterange)
- [Custom Value Objects](#custom-value-objects)
- [Validation](#validation)
- [Serialization](#serialization)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/value-objects

# yarn
yarn add @vytches-ddd/value-objects

# pnpm
pnpm add @vytches-ddd/value-objects
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches-ddd/domain-primitives @vytches-ddd/contracts
```

## ✨ Key Features

### Rich Value Objects
- **EntityId**: Strongly-typed entity identifiers with multiple formats
- **Money**: Currency-aware monetary values with arithmetic operations
- **Email**: Validated email addresses with domain extraction
- **Address**: Structured address representation with validation

### Advanced Features
- **Immutability**: All value objects are immutable by design
- **Validation**: Built-in validation with meaningful error messages
- **Serialization**: JSON serialization and deserialization support
- **Comparison**: Proper equality comparison and hash code generation

### Developer Experience
- **Type Safety**: Full TypeScript support with strict typing
- **Factory Methods**: Convenient creation methods for common patterns
- **Rich Behavior**: Domain-specific methods and operations
- **Testing Support**: Comprehensive testing utilities and builders

## 🎯 Core Concepts

### Value Object Pattern

Value objects are immutable objects that are defined by their value rather than their identity:

```typescript
// Value objects are compared by value, not reference
const money1 = new Money(100, 'USD');
const money2 = new Money(100, 'USD');

console.log(money1.equals(money2)); // true
console.log(money1 === money2); // false (different instances)

// Value objects are immutable
const money3 = money1.add(new Money(50, 'USD'));
console.log(money1.amount); // 100 (unchanged)
console.log(money3.amount); // 150 (new instance)
```

### Entity Identification

EntityId provides strongly-typed identifiers for domain entities:

```typescript
// Type-safe entity identification
const userId = EntityId.create(); // UUID by default
const orderId = EntityId.fromString('order-123');
const productId = EntityId.fromInteger(456);

// Prevents mixing entity types
function processOrder(orderId: EntityId, userId: EntityId) {
  // Type safety prevents mistakes
}

processOrder(orderId, userId); // ✅ Correct
processOrder(userId, orderId); // ❌ Type error
```

## 🚀 Quick Start

### 1. Using EntityId

```typescript
import { EntityId } from '@vytches-ddd/value-objects';

// Create new UUID-based ID
const id = EntityId.create();
console.log(id.value); // "550e8400-e29b-41d4-a716-446655440000"

// Create from string
const customId = EntityId.fromString('user-123');
console.log(customId.value); // "user-123"

// Create from integer
const numericId = EntityId.fromInteger(42);
console.log(numericId.value); // "42"

// Create from big integer
const bigId = EntityId.fromBigInt(BigInt('123456789012345'));
console.log(bigId.value); // "123456789012345"

// Type-safe comparison
const id1 = EntityId.create();
const id2 = EntityId.create();
console.log(id1.equals(id2)); // false
console.log(id1.equals(id1)); // true
```

### 2. Using Money

```typescript
import { Money } from '@vytches-ddd/value-objects';

// Create money values
const price = new Money(99.99, 'USD');
const tax = new Money(8.50, 'USD');

// Arithmetic operations
const total = price.add(tax);
console.log(total.amount); // 108.49
console.log(total.currency); // 'USD'

// Comparison operations
const budget = new Money(100, 'USD');
console.log(total.isGreaterThan(budget)); // true
console.log(total.isLessThan(budget)); // false

// Formatting
console.log(total.format()); // "$108.49"
console.log(total.format('en-EU')); // "108,49 $"
```

### 3. Using Email

```typescript
import { Email } from '@vytches-ddd/value-objects';

// Create validated email
const email = new Email('user@example.com');
console.log(email.value); // "user@example.com"

// Extract parts
console.log(email.localPart); // "user"
console.log(email.domain); // "example.com"
console.log(email.topLevelDomain); // "com"

// Validation
try {
  const invalidEmail = new Email('invalid-email');
} catch (error) {
  console.log(error.message); // "Invalid email format"
}

// Domain operations
console.log(email.isDomainEmail('example.com')); // true
console.log(email.isPersonalEmail()); // false (not gmail, yahoo, etc.)
```

### 4. Using Address

```typescript
import { Address } from '@vytches-ddd/value-objects';

// Create address
const address = new Address(
  '123 Main St',
  'Anytown',
  'NY',
  '12345',
  'USA'
);

// Access components
console.log(address.street); // "123 Main St"
console.log(address.city); // "Anytown"
console.log(address.state); // "NY"
console.log(address.zipCode); // "12345"
console.log(address.country); // "USA"

// Formatted output
console.log(address.getFullAddress());
// "123 Main St, Anytown, NY 12345, USA"

// Validation
try {
  const invalidAddress = new Address('', 'City', 'State', 'ZIP', 'Country');
} catch (error) {
  console.log(error.message); // "Street address is required"
}
```

## 🆔 EntityId

### Creation Methods

```typescript
import { EntityId } from '@vytches-ddd/value-objects';

// UUID-based (default)
const uuidId = EntityId.create();
console.log(uuidId.value); // "550e8400-e29b-41d4-a716-446655440000"

// String-based
const stringId = EntityId.fromString('user-123');
console.log(stringId.value); // "user-123"

// Integer-based
const intId = EntityId.fromInteger(42);
console.log(intId.value); // "42"

// Big integer-based
const bigIntId = EntityId.fromBigInt(BigInt('123456789012345'));
console.log(bigIntId.value); // "123456789012345"

// From existing value (type-safe)
const copyId = EntityId.fromValue(uuidId.value);
console.log(copyId.equals(uuidId)); // true
```

### Validation and Operations

```typescript
// Validation
console.log(EntityId.isValid('550e8400-e29b-41d4-a716-446655440000')); // true
console.log(EntityId.isValid('')); // false
console.log(EntityId.isValid(null)); // false

// Comparison
const id1 = EntityId.create();
const id2 = EntityId.create();
const id3 = EntityId.fromValue(id1.value);

console.log(id1.equals(id2)); // false
console.log(id1.equals(id3)); // true

// Serialization
const serialized = id1.toJSON();
console.log(serialized); // { value: "550e8400-e29b-41d4-a716-446655440000" }

const deserialized = EntityId.fromJSON(serialized);
console.log(deserialized.equals(id1)); // true
```

### Type Safety

```typescript
// EntityId provides type safety for entity identification
class User {
  constructor(public readonly id: EntityId) {}
}

class Order {
  constructor(
    public readonly id: EntityId,
    public readonly userId: EntityId
  ) {}
}

// Usage
const userId = EntityId.create();
const orderId = EntityId.create();

const user = new User(userId);
const order = new Order(orderId, userId);

// Type safety prevents mistakes
function findUser(id: EntityId): User | null {
  // Implementation
  return null;
}

findUser(userId); // ✅ Correct
findUser(orderId); // ✅ Also correct (both are EntityId)
findUser('string-id'); // ❌ Type error
```

## 💰 Money

### Creation and Basic Operations

```typescript
import { Money } from '@vytches-ddd/value-objects';

// Create money values
const price = new Money(99.99, 'USD');
const discount = new Money(10.00, 'USD');

// Arithmetic operations
const discountedPrice = price.subtract(discount);
console.log(discountedPrice.amount); // 89.99

const doublePrice = price.multiply(2);
console.log(doublePrice.amount); // 199.98

const halfPrice = price.divide(2);
console.log(halfPrice.amount); // 49.995

// Rounding
const roundedHalf = price.divide(2).round();
console.log(roundedHalf.amount); // 50.00
```

### Currency Operations

```typescript
// Currency validation
try {
  const invalidMoney = new Money(100, 'INVALID');
} catch (error) {
  console.log(error.message); // "Invalid currency code"
}

// Currency compatibility
const usd = new Money(100, 'USD');
const eur = new Money(85, 'EUR');

try {
  const mixed = usd.add(eur);
} catch (error) {
  console.log(error.message); // "Cannot operate on different currencies"
}

// Currency conversion (with external rate)
const conversionRate = 0.85;
const convertedToEur = usd.convertTo('EUR', conversionRate);
console.log(convertedToEur.amount); // 85.00
console.log(convertedToEur.currency); // "EUR"
```

### Comparison and Validation

```typescript
const money1 = new Money(100, 'USD');
const money2 = new Money(200, 'USD');

// Comparison
console.log(money1.isLessThan(money2)); // true
console.log(money1.isGreaterThan(money2)); // false
console.log(money1.equals(money2)); // false

// Validation
console.log(money1.isPositive()); // true
console.log(money1.isNegative()); // false
console.log(money1.isZero()); // false

// Zero and negative values
const zero = Money.zero('USD');
console.log(zero.isZero()); // true

const negative = new Money(-50, 'USD');
console.log(negative.isNegative()); // true
```

### Formatting

```typescript
const money = new Money(1234.56, 'USD');

// Default formatting
console.log(money.format()); // "$1,234.56"

// Locale-specific formatting
console.log(money.format('en-US')); // "$1,234.56"
console.log(money.format('en-GB')); // "US$1,234.56"
console.log(money.format('de-DE')); // "1.234,56 $"

// Custom formatting
console.log(money.format('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
})); // "$1,234.560"
```

## 📧 Email

### Creation and Validation

```typescript
import { Email } from '@vytches-ddd/value-objects';

// Valid email creation
const email = new Email('user@example.com');
console.log(email.value); // "user@example.com"

// Case normalization
const upperEmail = new Email('USER@EXAMPLE.COM');
console.log(upperEmail.value); // "user@example.com"

// Validation errors
try {
  new Email('invalid-email');
} catch (error) {
  console.log(error.message); // "Invalid email format"
}

try {
  new Email('');
} catch (error) {
  console.log(error.message); // "Email cannot be empty"
}
```

### Email Analysis

```typescript
const email = new Email('john.doe+newsletter@company.co.uk');

// Component extraction
console.log(email.localPart); // "john.doe+newsletter"
console.log(email.domain); // "company.co.uk"
console.log(email.topLevelDomain); // "uk"

// Advanced analysis
console.log(email.hasPlus()); // true
console.log(email.getPlusTag()); // "newsletter"
console.log(email.getBaseEmail()); // "john.doe@company.co.uk"

// Domain analysis
console.log(email.isDomainEmail('company.co.uk')); // true
console.log(email.isPersonalEmail()); // false
console.log(email.isBusinessEmail()); // true
```

### Common Email Patterns

```typescript
// Personal email detection
const personalEmails = [
  'user@gmail.com',
  'user@yahoo.com',
  'user@hotmail.com',
  'user@outlook.com'
];

personalEmails.forEach(emailStr => {
  const email = new Email(emailStr);
  console.log(`${emailStr}: ${email.isPersonalEmail()}`); // true for all
});

// Business email detection
const businessEmail = new Email('employee@company.com');
console.log(businessEmail.isBusinessEmail()); // true

// Disposable email detection
const disposableEmail = new Email('user@10minutemail.com');
console.log(disposableEmail.isDisposableEmail()); // true
```

## 🏠 Address

### Creation and Components

```typescript
import { Address } from '@vytches-ddd/value-objects';

// Complete address
const address = new Address(
  '123 Main Street, Apt 4B',
  'New York',
  'NY',
  '10001',
  'USA'
);

// Access components
console.log(address.street); // "123 Main Street, Apt 4B"
console.log(address.city); // "New York"
console.log(address.state); // "NY"
console.log(address.zipCode); // "10001"
console.log(address.country); // "USA"

// Extended address (with optional fields)
const extendedAddress = new Address(
  '456 Oak Avenue',
  'Los Angeles',
  'CA',
  '90210',
  'USA',
  'Suite 100' // optional apartment/unit
);

console.log(extendedAddress.apartment); // "Suite 100"
```

### Address Formatting

```typescript
const address = new Address(
  '123 Main St',
  'Anytown',
  'NY',
  '12345',
  'USA'
);

// Full address formatting
console.log(address.getFullAddress());
// "123 Main St, Anytown, NY 12345, USA"

// Mailing format
console.log(address.getMailingFormat());
// "123 Main St\nAnytown, NY 12345\nUSA"

// Short format (without country)
console.log(address.getShortFormat());
// "123 Main St, Anytown, NY 12345"
```

### Address Validation

```typescript
// Required field validation
try {
  new Address('', 'City', 'State', 'ZIP', 'Country');
} catch (error) {
  console.log(error.message); // "Street address is required"
}

// ZIP code validation
try {
  new Address('123 Main St', 'City', 'NY', '', 'USA');
} catch (error) {
  console.log(error.message); // "ZIP code is required"
}

// Country-specific validation
const usAddress = new Address('123 Main St', 'City', 'NY', '12345', 'USA');
console.log(usAddress.isUSAddress()); // true
console.log(usAddress.isValidUSZipCode()); // true

const ukAddress = new Address('123 High St', 'London', 'ENG', 'SW1A 1AA', 'UK');
console.log(ukAddress.isUKAddress()); // true
console.log(ukAddress.isValidUKPostcode()); // true
```

## 📞 PhoneNumber

### Creation and Validation

```typescript
import { PhoneNumber } from '@vytches-ddd/value-objects';

// US phone number
const phoneNumber = new PhoneNumber('+1 (555) 123-4567');
console.log(phoneNumber.value); // "+15551234567"

// International number
const intlNumber = new PhoneNumber('+44 20 7946 0958');
console.log(intlNumber.value); // "+442079460958"

// Validation
try {
  new PhoneNumber('invalid');
} catch (error) {
  console.log(error.message); // "Invalid phone number format"
}
```

### Number Analysis

```typescript
const phoneNumber = new PhoneNumber('+1 (555) 123-4567');

// Component extraction
console.log(phoneNumber.getCountryCode()); // "1"
console.log(phoneNumber.getAreaCode()); // "555"
console.log(phoneNumber.getNumber()); // "1234567"

// Type detection
console.log(phoneNumber.isUSNumber()); // true
console.log(phoneNumber.isMobileNumber()); // false (555 is not mobile)
console.log(phoneNumber.isTollFree()); // false

// Formatting
console.log(phoneNumber.format()); // "+1 (555) 123-4567"
console.log(phoneNumber.formatNational()); // "(555) 123-4567"
console.log(phoneNumber.formatInternational()); // "+1 555 123 4567"
```

### Mobile and Special Numbers

```typescript
// Mobile number
const mobileNumber = new PhoneNumber('+1 (555) 000-1234');
console.log(mobileNumber.isMobileNumber()); // true

// Toll-free number
const tollFreeNumber = new PhoneNumber('+1 (800) 123-4567');
console.log(tollFreeNumber.isTollFree()); // true

// International mobile
const intlMobile = new PhoneNumber('+44 7700 900123');
console.log(intlMobile.isMobileNumber()); // true
console.log(intlMobile.getCountryCode()); // "44"
```

## 📅 DateRange

### Creation and Validation

```typescript
import { DateRange } from '@vytches-ddd/value-objects';

// Create date range
const startDate = new Date('2023-01-01');
const endDate = new Date('2023-12-31');
const yearRange = new DateRange(startDate, endDate);

console.log(yearRange.startDate); // 2023-01-01T00:00:00.000Z
console.log(yearRange.endDate); // 2023-12-31T00:00:00.000Z

// Validation
try {
  new DateRange(endDate, startDate); // End before start
} catch (error) {
  console.log(error.message); // "End date must be after start date"
}
```

### Range Operations

```typescript
const range1 = new DateRange(
  new Date('2023-01-01'),
  new Date('2023-06-30')
);

const range2 = new DateRange(
  new Date('2023-04-01'),
  new Date('2023-09-30')
);

// Overlap detection
console.log(range1.overlaps(range2)); // true

// Contains date
const testDate = new Date('2023-03-15');
console.log(range1.contains(testDate)); // true

// Duration calculation
console.log(range1.getDurationInDays()); // 180
console.log(range1.getDurationInMonths()); // 6

// Range intersection
const intersection = range1.getIntersection(range2);
console.log(intersection.startDate); // 2023-04-01
console.log(intersection.endDate); // 2023-06-30
```

### Date Range Utilities

```typescript
// Business days calculation
const businessDays = range1.getBusinessDays();
console.log(businessDays); // Excludes weekends

// Split into periods
const monthlyPeriods = range1.splitIntoMonths();
console.log(monthlyPeriods.length); // 6

// Extend range
const extendedRange = range1.extend(30); // Extend by 30 days
console.log(extendedRange.endDate); // 2023-07-30

// Common ranges
const thisMonth = DateRange.thisMonth();
const thisYear = DateRange.thisYear();
const lastWeek = DateRange.lastWeek();
```

## 🏗️ Custom Value Objects

### Creating Custom Value Objects

```typescript
import { ValueObject } from '@vytches-ddd/domain-primitives';

// Custom value object for Social Security Number
class SocialSecurityNumber extends ValueObject {
  private readonly value: string;
  
  constructor(ssn: string) {
    super();
    this.value = this.normalize(ssn);
  }
  
  public get Value(): string {
    return this.value;
  }
  
  public format(): string {
    return `${this.value.slice(0, 3)}-${this.value.slice(3, 5)}-${this.value.slice(5)}`;
  }
  
  public getAreaNumber(): string {
    return this.value.slice(0, 3);
  }
  
  public getGroupNumber(): string {
    return this.value.slice(3, 5);
  }
  
  public getSerialNumber(): string {
    return this.value.slice(5);
  }
  
  protected getEqualityComponents(): any[] {
    return [this.value];
  }
  
  private normalize(ssn: string): string {
    // Remove all non-digit characters
    const digits = ssn.replace(/\D/g, '');
    
    if (digits.length !== 9) {
      throw new ValidationError('SSN must be 9 digits', 'ssn', ssn);
    }
    
    if (digits === '000000000' || digits === '123456789') {
      throw new ValidationError('Invalid SSN pattern', 'ssn', ssn);
    }
    
    return digits;
  }
}

// Usage
const ssn = new SocialSecurityNumber('123-45-6789');
console.log(ssn.Value); // "123456789"
console.log(ssn.format()); // "123-45-6789"
console.log(ssn.getAreaNumber()); // "123"
```

### Complex Value Objects

```typescript
// Custom value object for geographic coordinates
class Coordinates extends ValueObject {
  constructor(
    private readonly latitude: number,
    private readonly longitude: number
  ) {
    super();
    this.validate();
  }
  
  public get Latitude(): number {
    return this.latitude;
  }
  
  public get Longitude(): number {
    return this.longitude;
  }
  
  public distanceTo(other: Coordinates): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(other.latitude - this.latitude);
    const dLon = this.toRadians(other.longitude - this.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(this.latitude)) *
              Math.cos(this.toRadians(other.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  public format(): string {
    return `${this.latitude.toFixed(6)}, ${this.longitude.toFixed(6)}`;
  }
  
  protected getEqualityComponents(): any[] {
    return [this.latitude, this.longitude];
  }
  
  private validate(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90', 'latitude', this.latitude);
    }
    
    if (this.longitude < -180 || this.longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180', 'longitude', this.longitude);
    }
  }
  
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Usage
const newYork = new Coordinates(40.7128, -74.0060);
const london = new Coordinates(51.5074, -0.1278);

console.log(newYork.format()); // "40.712800, -74.006000"
console.log(newYork.distanceTo(london)); // 5585.27 km
```

## ✅ Validation

### Built-in Validators

```typescript
import { 
  EmailValidator,
  PhoneNumberValidator,
  CurrencyValidator,
  ZipCodeValidator
} from '@vytches-ddd/value-objects';

// Email validation
const emailValidator = new EmailValidator();
console.log(emailValidator.isValid('user@example.com')); // true
console.log(emailValidator.isValid('invalid')); // false

// Phone number validation
const phoneValidator = new PhoneNumberValidator();
console.log(phoneValidator.isValid('+1 (555) 123-4567')); // true
console.log(phoneValidator.isValid('invalid')); // false

// Currency validation
const currencyValidator = new CurrencyValidator();
console.log(currencyValidator.isValid('USD')); // true
console.log(currencyValidator.isValid('INVALID')); // false

// ZIP code validation
const zipValidator = new ZipCodeValidator();
console.log(zipValidator.isValidUSZip('12345')); // true
console.log(zipValidator.isValidUSZip('123')); // false
```

### Custom Validators

```typescript
// Custom validator for credit card numbers
class CreditCardValidator {
  public static isValid(cardNumber: string): boolean {
    // Remove spaces and hyphens
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    
    // Check if all digits
    if (!/^\d+$/.test(cleaned)) {
      return false;
    }
    
    // Check length
    if (cleaned.length < 13 || cleaned.length > 19) {
      return false;
    }
    
    // Luhn algorithm
    return this.luhnCheck(cleaned);
  }
  
  private static luhnCheck(cardNumber: string): boolean {
    let sum = 0;
    let alternate = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));
      
      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit = (digit % 10) + 1;
        }
      }
      
      sum += digit;
      alternate = !alternate;
    }
    
    return sum % 10 === 0;
  }
}

// Usage
console.log(CreditCardValidator.isValid('4532 1234 5678 9012')); // true
console.log(CreditCardValidator.isValid('1234 5678 9012 3456')); // false
```

## 📋 Serialization

### JSON Serialization

```typescript
// All value objects support JSON serialization
const money = new Money(100, 'USD');
const email = new Email('user@example.com');
const address = new Address('123 Main St', 'City', 'NY', '12345', 'USA');

// Serialize to JSON
const moneyJson = money.toJSON();
console.log(moneyJson); // { amount: 100, currency: 'USD' }

const emailJson = email.toJSON();
console.log(emailJson); // { value: 'user@example.com' }

const addressJson = address.toJSON();
console.log(addressJson); 
// { street: '123 Main St', city: 'City', state: 'NY', zipCode: '12345', country: 'USA' }
```

### Deserialization

```typescript
// Deserialize from JSON
const deserializedMoney = Money.fromJSON(moneyJson);
console.log(deserializedMoney.equals(money)); // true

const deserializedEmail = Email.fromJSON(emailJson);
console.log(deserializedEmail.equals(email)); // true

const deserializedAddress = Address.fromJSON(addressJson);
console.log(deserializedAddress.equals(address)); // true
```

### Custom Serialization

```typescript
// Custom serialization for complex value objects
class PersonName extends ValueObject {
  constructor(
    private readonly firstName: string,
    private readonly lastName: string,
    private readonly middleName?: string
  ) {
    super();
  }
  
  public get FirstName(): string {
    return this.firstName;
  }
  
  public get LastName(): string {
    return this.lastName;
  }
  
  public get MiddleName(): string | undefined {
    return this.middleName;
  }
  
  public getFullName(): string {
    const parts = [this.firstName];
    if (this.middleName) {
      parts.push(this.middleName);
    }
    parts.push(this.lastName);
    return parts.join(' ');
  }
  
  public toJSON(): object {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      middleName: this.middleName,
      fullName: this.getFullName()
    };
  }
  
  public static fromJSON(json: any): PersonName {
    return new PersonName(
      json.firstName,
      json.lastName,
      json.middleName
    );
  }
  
  protected getEqualityComponents(): any[] {
    return [this.firstName, this.lastName, this.middleName];
  }
}
```

## 🧪 Testing

### Unit Testing Value Objects

```typescript
import { describe, it, expect } from 'vitest';
import { Money, Email, Address } from '@vytches-ddd/value-objects';

describe('Money', () => {
  it('should create money with valid amount and currency', () => {
    // Arrange & Act
    const money = new Money(100, 'USD');
    
    // Assert
    expect(money.amount).toBe(100);
    expect(money.currency).toBe('USD');
  });
  
  it('should add money with same currency', () => {
    // Arrange
    const money1 = new Money(100, 'USD');
    const money2 = new Money(50, 'USD');
    
    // Act
    const result = money1.add(money2);
    
    // Assert
    expect(result.amount).toBe(150);
    expect(result.currency).toBe('USD');
  });
  
  it('should throw error when adding different currencies', () => {
    // Arrange
    const money1 = new Money(100, 'USD');
    const money2 = new Money(50, 'EUR');
    
    // Act & Assert
    expect(() => money1.add(money2)).toThrow('Cannot operate on different currencies');
  });
});

describe('Email', () => {
  it('should create email with valid address', () => {
    // Arrange & Act
    const email = new Email('user@example.com');
    
    // Assert
    expect(email.value).toBe('user@example.com');
    expect(email.localPart).toBe('user');
    expect(email.domain).toBe('example.com');
  });
  
  it('should normalize email to lowercase', () => {
    // Arrange & Act
    const email = new Email('USER@EXAMPLE.COM');
    
    // Assert
    expect(email.value).toBe('user@example.com');
  });
  
  it('should throw error for invalid email', () => {
    // Act & Assert
    expect(() => new Email('invalid-email')).toThrow('Invalid email format');
  });
});
```

### Test Builders

```typescript
// Test builder for complex value objects
class AddressBuilder {
  private street: string = '123 Main St';
  private city: string = 'Anytown';
  private state: string = 'NY';
  private zipCode: string = '12345';
  private country: string = 'USA';
  
  public withStreet(street: string): AddressBuilder {
    this.street = street;
    return this;
  }
  
  public withCity(city: string): AddressBuilder {
    this.city = city;
    return this;
  }
  
  public withState(state: string): AddressBuilder {
    this.state = state;
    return this;
  }
  
  public withZipCode(zipCode: string): AddressBuilder {
    this.zipCode = zipCode;
    return this;
  }
  
  public withCountry(country: string): AddressBuilder {
    this.country = country;
    return this;
  }
  
  public build(): Address {
    return new Address(this.street, this.city, this.state, this.zipCode, this.country);
  }
}

// Usage in tests
describe('Address', () => {
  it('should create address with all components', () => {
    // Arrange
    const address = new AddressBuilder()
      .withStreet('456 Oak Ave')
      .withCity('Springfield')
      .withState('IL')
      .withZipCode('62701')
      .build();
    
    // Assert
    expect(address.street).toBe('456 Oak Ave');
    expect(address.city).toBe('Springfield');
    expect(address.state).toBe('IL');
    expect(address.zipCode).toBe('62701');
  });
});
```

### Property-Based Testing

```typescript
import { fc } from 'fast-check';

// Property-based testing for Money
describe('Money Properties', () => {
  it('should be associative for addition', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 1000000 }),
      fc.float({ min: 0, max: 1000000 }),
      fc.float({ min: 0, max: 1000000 }),
      fc.constantFrom('USD', 'EUR', 'GBP'),
      (a, b, c, currency) => {
        const money1 = new Money(a, currency);
        const money2 = new Money(b, currency);
        const money3 = new Money(c, currency);
        
        // (a + b) + c = a + (b + c)
        const left = money1.add(money2).add(money3);
        const right = money1.add(money2.add(money3));
        
        expect(left.equals(right)).toBe(true);
      }
    ));
  });
});
```

## 🏆 Best Practices

### Value Object Design

```typescript
// ✅ Good: Immutable, validated, rich behavior
class ISBN extends ValueObject {
  private readonly value: string;
  
  constructor(isbn: string) {
    super();
    this.value = this.normalize(isbn);
  }
  
  public get Value(): string {
    return this.value;
  }
  
  public isISBN10(): boolean {
    return this.value.length === 10;
  }
  
  public isISBN13(): boolean {
    return this.value.length === 13;
  }
  
  public format(): string {
    if (this.isISBN13()) {
      return `${this.value.slice(0, 3)}-${this.value.slice(3, 4)}-${this.value.slice(4, 6)}-${this.value.slice(6, 12)}-${this.value.slice(12)}`;
    } else {
      return `${this.value.slice(0, 1)}-${this.value.slice(1, 4)}-${this.value.slice(4, 9)}-${this.value.slice(9)}`;
    }
  }
  
  protected getEqualityComponents(): any[] {
    return [this.value];
  }
  
  private normalize(isbn: string): string {
    const cleaned = isbn.replace(/[\s-]/g, '');
    
    if (!/^[\d]{9}[\dX]$/.test(cleaned) && !/^[\d]{13}$/.test(cleaned)) {
      throw new ValidationError('Invalid ISBN format', 'isbn', isbn);
    }
    
    return cleaned;
  }
}

// ❌ Bad: Mutable, no validation
class ISBN {
  public value: string;
  
  constructor(isbn: string) {
    this.value = isbn; // No validation
  }
}
```

### Validation Strategy

```typescript
// ✅ Good: Comprehensive validation
class CreditCard extends ValueObject {
  private readonly number: string;
  private readonly type: CreditCardType;
  
  constructor(cardNumber: string) {
    super();
    this.number = this.normalize(cardNumber);
    this.type = this.detectType(this.number);
  }
  
  public get Number(): string {
    return this.number;
  }
  
  public get Type(): CreditCardType {
    return this.type;
  }
  
  public getMaskedNumber(): string {
    const last4 = this.number.slice(-4);
    const masked = '*'.repeat(this.number.length - 4);
    return `${masked}${last4}`;
  }
  
  protected getEqualityComponents(): any[] {
    return [this.number];
  }
  
  private normalize(cardNumber: string): string {
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    
    if (!/^\d+$/.test(cleaned)) {
      throw new ValidationError('Credit card number must contain only digits', 'cardNumber', cardNumber);
    }
    
    if (cleaned.length < 13 || cleaned.length > 19) {
      throw new ValidationError('Credit card number must be between 13 and 19 digits', 'cardNumber', cardNumber);
    }
    
    if (!this.luhnCheck(cleaned)) {
      throw new ValidationError('Invalid credit card number', 'cardNumber', cardNumber);
    }
    
    return cleaned;
  }
  
  private detectType(number: string): CreditCardType {
    if (number.startsWith('4')) return CreditCardType.VISA;
    if (number.startsWith('5') || number.startsWith('2')) return CreditCardType.MASTERCARD;
    if (number.startsWith('3')) return CreditCardType.AMEX;
    return CreditCardType.UNKNOWN;
  }
  
  private luhnCheck(number: string): boolean {
    // Implementation details...
    return true;
  }
}
```

### Error Handling

```typescript
// ✅ Good: Specific error types and messages
class TaxId extends ValueObject {
  private readonly value: string;
  
  constructor(taxId: string) {
    super();
    this.value = this.validate(taxId);
  }
  
  private validate(taxId: string): string {
    if (!taxId) {
      throw new ValidationError('Tax ID cannot be empty', 'taxId', taxId);
    }
    
    const cleaned = taxId.replace(/[\s-]/g, '');
    
    if (!/^\d{9}$/.test(cleaned)) {
      throw new ValidationError('Tax ID must be 9 digits', 'taxId', taxId);
    }
    
    if (cleaned === '000000000') {
      throw new ValidationError('Tax ID cannot be all zeros', 'taxId', taxId);
    }
    
    return cleaned;
  }
}

// ❌ Bad: Generic errors
class TaxId {
  constructor(taxId: string) {
    if (!taxId) {
      throw new Error('Invalid'); // Too generic
    }
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/PawelGozdz/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches-ddd/value-objects

# Run tests
pnpm test --filter=@vytches-ddd/value-objects

# Run in development mode
pnpm dev --filter=@vytches-ddd/value-objects
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches-ddd](https://github.com/PawelGozdz/vytches-ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).