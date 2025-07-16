# @vytches-ddd/validation

<!-- LLM-METADATA
Package: @vytches-ddd/validation
Category: Patterns
Purpose: Comprehensive validation framework with specifications, rules, and domain-specific validators
Dependencies: @vytches-ddd/domain-primitives, @vytches-ddd/utils
Complexity: Medium
DDD Patterns: Specification Pattern, Validation Rules, Domain Validators
Integration Points: @vytches-ddd/policies, @vytches-ddd/cqrs, @vytches-ddd/value-objects
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fvalidation.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fvalidation)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Comprehensive validation framework with specifications, fluent rules, and
> domain-specific validators**

Enterprise-grade validation system with specification pattern integration,
fluent rule builder, async validation support, and comprehensive error
reporting. Designed for complex domain validation scenarios.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Specification Pattern](#specification-pattern)
- [Fluent Rules](#fluent-rules)
- [Domain Validators](#domain-validators)
- [Async Validation](#async-validation)
- [Validation Context](#validation-context)
- [Error Handling](#error-handling)
- [Custom Validators](#custom-validators)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/validation

# yarn
yarn add @vytches-ddd/validation

# pnpm
pnpm add @vytches-ddd/validation
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches-ddd/domain-primitives @vytches-ddd/utils
```

## ✨ Key Features

### Validation Framework

- **Specification Pattern**: Composable business rules with logical operations
- **Fluent Rules**: Intuitive fluent API for building validation rules
- **Domain Validators**: Built-in validators for common domain objects
- **Async Validation**: Support for asynchronous validation operations

### Enterprise Features

- **Validation Context**: Rich context propagation for complex scenarios
- **Error Reporting**: Comprehensive error details with field-level information
- **Conditional Validation**: Dynamic validation based on conditions
- **Rule Composition**: Combine multiple validation rules with logical operators

### Developer Experience

- **Type Safety**: Full TypeScript support with strict typing
- **Extensible**: Easy to create custom validators and specifications
- **Testing Support**: Comprehensive testing utilities and mocks
- **Integration**: Seamless integration with other VytchesDDD packages

## 🎯 Core Concepts

### Specification Pattern

Specifications encapsulate validation rules that can be composed:

```typescript
// Base specification interface
interface ISpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

// Async specification interface
interface IAsyncSpecification<T> {
  isSatisfiedByAsync(entity: T): Promise<boolean>;
  andAsync(other: IAsyncSpecification<T>): IAsyncSpecification<T>;
  orAsync(other: IAsyncSpecification<T>): IAsyncSpecification<T>;
  notAsync(): IAsyncSpecification<T>;
}
```

### Validation Rules

Fluent API for building validation rules:

```typescript
// Rule builder interface
interface IRuleBuilder<T> {
  required(): IRuleBuilder<T>;
  optional(): IRuleBuilder<T>;
  minLength(length: number): IRuleBuilder<T>;
  maxLength(length: number): IRuleBuilder<T>;
  pattern(regex: RegExp): IRuleBuilder<T>;
  custom(validator: (value: T) => boolean): IRuleBuilder<T>;
  build(): IValidationRule<T>;
}
```

### Validation Result

Comprehensive validation result with error details:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

## 🚀 Quick Start

### 1. Basic Specification Usage

```typescript
import { Specification } from '@vytches-ddd/validation';

// Create a simple specification
class AgeSpecification extends Specification<User> {
  constructor(private readonly minAge: number) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.age >= this.minAge;
  }
}

class EmailSpecification extends Specification<User> {
  isSatisfiedBy(user: User): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(user.email);
  }
}

// Compose specifications
const userValidation = new AgeSpecification(18).and(new EmailSpecification());

// Validate user
const user = new User('John Doe', 'john@example.com', 25);
const isValid = userValidation.isSatisfiedBy(user);
console.log('User is valid:', isValid);
```

### 2. Fluent Rules

```typescript
import { Rules } from '@vytches-ddd/validation';

// Create fluent rules
const nameRule = Rules.forString()
  .required()
  .minLength(2)
  .maxLength(50)
  .pattern(/^[A-Za-z\s]+$/)
  .build();

const emailRule = Rules.forString().required().email().build();

const ageRule = Rules.forNumber().required().min(18).max(120).build();

// Validate individual fields
const nameValidation = nameRule.validate('John Doe');
const emailValidation = emailRule.validate('john@example.com');
const ageValidation = ageRule.validate(25);

console.log('Name valid:', nameValidation.isValid);
console.log('Email valid:', emailValidation.isValid);
console.log('Age valid:', ageValidation.isValid);
```

### 3. Domain Validators

```typescript
import { DomainValidator } from '@vytches-ddd/validation';

// Create domain validator
const userValidator = DomainValidator.create<User>()
  .forProperty('name', Rules.forString().required().minLength(2))
  .forProperty('email', Rules.forString().required().email())
  .forProperty('age', Rules.forNumber().required().min(18))
  .build();

// Validate entire object
const user = new User('John Doe', 'john@example.com', 25);
const validation = await userValidator.validate(user);

if (!validation.isValid) {
  console.log('Validation errors:');
  validation.errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
}
```

## 🔍 Specification Pattern

### Basic Specifications

```typescript
import { Specification } from '@vytches-ddd/validation';

// User age specification
class UserAgeSpecification extends Specification<User> {
  constructor(private readonly minAge: number) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.age >= this.minAge;
  }
}

// User email specification
class UserEmailSpecification extends Specification<User> {
  isSatisfiedBy(user: User): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(user.email);
  }
}

// User role specification
class UserRoleSpecification extends Specification<User> {
  constructor(private readonly allowedRoles: UserRole[]) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return this.allowedRoles.includes(user.role);
  }
}
```

### Composite Specifications

```typescript
// Combine specifications with logical operators
const adultUserSpec = new UserAgeSpecification(18);
const validEmailSpec = new UserEmailSpecification();
const adminOrManagerSpec = new UserRoleSpecification([
  UserRole.ADMIN,
  UserRole.MANAGER,
]);

// AND operation
const validAdultUser = adultUserSpec.and(validEmailSpec);

// OR operation
const privilegedUser = adminOrManagerSpec.or(
  new UserRoleSpecification([UserRole.SUPERVISOR])
);

// NOT operation
const nonAdminUser = adminOrManagerSpec.not();

// Complex composition
const validPrivilegedAdult = adultUserSpec
  .and(validEmailSpec)
  .and(privilegedUser);

// Usage
const user = new User('John Doe', 'john@example.com', 25, UserRole.ADMIN);
const isValid = validPrivilegedAdult.isSatisfiedBy(user);
```

### Parametrized Specifications

```typescript
// Specifications with parameters
class UserRegistrationDateSpecification extends Specification<User> {
  constructor(
    private readonly startDate: Date,
    private readonly endDate: Date
  ) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return (
      user.registeredAt >= this.startDate && user.registeredAt <= this.endDate
    );
  }
}

class UserLocationSpecification extends Specification<User> {
  constructor(private readonly allowedCountries: string[]) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return this.allowedCountries.includes(user.country);
  }
}

// Usage with parameters
const recentUsers = new UserRegistrationDateSpecification(
  new Date('2023-01-01'),
  new Date('2023-12-31')
);

const euUsers = new UserLocationSpecification(['DE', 'FR', 'ES', 'IT']);

const recentEuUsers = recentUsers.and(euUsers);
```

## 📏 Fluent Rules

### String Rules

```typescript
import { Rules } from '@vytches-ddd/validation';

// String validation rules
const nameRule = Rules.forString()
  .required()
  .minLength(2)
  .maxLength(50)
  .pattern(/^[A-Za-z\s]+$/)
  .withMessage('Name must contain only letters and spaces')
  .build();

const emailRule = Rules.forString()
  .required()
  .email()
  .withMessage('Please provide a valid email address')
  .build();

const phoneRule = Rules.forString()
  .optional()
  .phone()
  .withMessage('Please provide a valid phone number')
  .build();

const passwordRule = Rules.forString()
  .required()
  .minLength(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage(
    'Password must contain uppercase, lowercase, number and special character'
  )
  .build();

// Validate strings
const nameValidation = nameRule.validate('John Doe');
const emailValidation = emailRule.validate('john@example.com');
const phoneValidation = phoneRule.validate('+1-555-123-4567');
const passwordValidation = passwordRule.validate('SecurePass123!');
```

### Number Rules

```typescript
// Number validation rules
const ageRule = Rules.forNumber()
  .required()
  .min(18)
  .max(120)
  .withMessage('Age must be between 18 and 120')
  .build();

const priceRule = Rules.forNumber()
  .required()
  .min(0)
  .precision(2)
  .withMessage('Price must be a positive number with up to 2 decimal places')
  .build();

const scoreRule = Rules.forNumber()
  .required()
  .min(0)
  .max(100)
  .integer()
  .withMessage('Score must be an integer between 0 and 100')
  .build();

// Validate numbers
const ageValidation = ageRule.validate(25);
const priceValidation = priceRule.validate(99.99);
const scoreValidation = scoreRule.validate(85);
```

### Date Rules

```typescript
// Date validation rules
const birthDateRule = Rules.forDate()
  .required()
  .before(new Date()) // Must be in the past
  .after(new Date('1900-01-01')) // Not too far in the past
  .withMessage('Birth date must be between 1900 and today')
  .build();

const appointmentRule = Rules.forDate()
  .required()
  .after(new Date()) // Must be in the future
  .within(30, 'days') // Within 30 days
  .withMessage('Appointment must be scheduled within the next 30 days')
  .build();

// Validate dates
const birthDateValidation = birthDateRule.validate(new Date('1990-05-15'));
const appointmentValidation = appointmentRule.validate(new Date('2024-02-15'));
```

### Array Rules

```typescript
// Array validation rules
const tagsRule = Rules.forArray<string>()
  .required()
  .minLength(1)
  .maxLength(10)
  .eachItem(Rules.forString().required().minLength(2))
  .withMessage('Tags must contain 1-10 items, each at least 2 characters')
  .build();

const scoresRule = Rules.forArray<number>()
  .optional()
  .minLength(0)
  .maxLength(100)
  .eachItem(Rules.forNumber().min(0).max(100))
  .withMessage('Scores must be between 0 and 100')
  .build();

// Validate arrays
const tagsValidation = tagsRule.validate([
  'technology',
  'programming',
  'typescript',
]);
const scoresValidation = scoresRule.validate([85, 92, 78, 90]);
```

### Object Rules

```typescript
// Object validation rules
const addressRule = Rules.forObject<Address>()
  .required()
  .property('street', Rules.forString().required().minLength(5))
  .property('city', Rules.forString().required().minLength(2))
  .property(
    'zipCode',
    Rules.forString()
      .required()
      .pattern(/^\d{5}(-\d{4})?$/)
  )
  .property('country', Rules.forString().required().minLength(2))
  .build();

const userRule = Rules.forObject<User>()
  .required()
  .property('name', Rules.forString().required().minLength(2))
  .property('email', Rules.forString().required().email())
  .property('age', Rules.forNumber().required().min(18))
  .property('address', addressRule)
  .build();

// Validate objects
const address = new Address('123 Main St', 'New York', '10001', 'USA');
const user = new User('John Doe', 'john@example.com', 25, address);
const userValidation = userRule.validate(user);
```

## 🏗️ Domain Validators

### Entity Validators

```typescript
import { DomainValidator } from '@vytches-ddd/validation';

// User entity validator
const userValidator = DomainValidator.create<User>()
  .forProperty('id', Rules.forString().required().uuid())
  .forProperty('name', Rules.forString().required().minLength(2).maxLength(50))
  .forProperty('email', Rules.forString().required().email())
  .forProperty('age', Rules.forNumber().required().min(18).max(120))
  .forProperty('role', Rules.forEnum(UserRole).required())
  .forProperty('createdAt', Rules.forDate().required().before(new Date()))
  .forProperty(
    'updatedAt',
    Rules.forDate()
      .required()
      .after(entity => entity.createdAt)
  )
  .build();

// Order entity validator
const orderValidator = DomainValidator.create<Order>()
  .forProperty('id', Rules.forString().required().uuid())
  .forProperty('customerId', Rules.forString().required().uuid())
  .forProperty('items', Rules.forArray().required().minLength(1))
  .forProperty('status', Rules.forEnum(OrderStatus).required())
  .forProperty('totalAmount', Rules.forNumber().required().min(0))
  .forProperty('currency', Rules.forString().required().length(3))
  .build();

// Validate entities
const userValidation = await userValidator.validate(user);
const orderValidation = await orderValidator.validate(order);
```

### Value Object Validators

```typescript
// Email value object validator
const emailValidator = DomainValidator.create<Email>()
  .forProperty('value', Rules.forString().required().email())
  .forProperty('domain', Rules.forString().required())
  .forProperty('localPart', Rules.forString().required())
  .build();

// Money value object validator
const moneyValidator = DomainValidator.create<Money>()
  .forProperty('amount', Rules.forNumber().required().min(0))
  .forProperty('currency', Rules.forString().required().length(3))
  .build();

// Address value object validator
const addressValidator = DomainValidator.create<Address>()
  .forProperty('street', Rules.forString().required().minLength(5))
  .forProperty('city', Rules.forString().required().minLength(2))
  .forProperty('state', Rules.forString().required().length(2))
  .forProperty(
    'zipCode',
    Rules.forString()
      .required()
      .pattern(/^\d{5}(-\d{4})?$/)
  )
  .forProperty('country', Rules.forString().required().length(2))
  .build();

// Validate value objects
const emailValidation = await emailValidator.validate(email);
const moneyValidation = await moneyValidator.validate(money);
const addressValidation = await addressValidator.validate(address);
```

### Aggregate Validators

```typescript
// User aggregate validator
const userAggregateValidator = DomainValidator.create<UserAggregate>()
  .forProperty('id', Rules.forString().required().uuid())
  .forProperty('version', Rules.forNumber().required().min(0))
  .forProperty('profile', userValidator)
  .forProperty('preferences', Rules.forObject().optional())
  .forProperty('subscription', Rules.forObject().optional())
  .build();

// Order aggregate validator
const orderAggregateValidator = DomainValidator.create<OrderAggregate>()
  .forProperty('id', Rules.forString().required().uuid())
  .forProperty('version', Rules.forNumber().required().min(0))
  .forProperty('customerId', Rules.forString().required().uuid())
  .forProperty('items', Rules.forArray().required().minLength(1))
  .forProperty('status', Rules.forEnum(OrderStatus).required())
  .forProperty('paymentInfo', Rules.forObject().optional())
  .forProperty('shippingAddress', addressValidator)
  .forProperty('billingAddress', addressValidator)
  .build();

// Validate aggregates
const userAggregateValidation =
  await userAggregateValidator.validate(userAggregate);
const orderAggregateValidation =
  await orderAggregateValidator.validate(orderAggregate);
```

## ⚡ Async Validation

### Async Specifications

```typescript
import { AsyncSpecification } from '@vytches-ddd/validation';

// Email uniqueness specification
class EmailUniquenessSpecification extends AsyncSpecification<User> {
  constructor(private readonly userRepository: IUserRepository) {
    super();
  }

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    const existingUser = await this.userRepository.findByEmail(user.email);
    return existingUser === null || existingUser.id === user.id;
  }
}

// External validation specification
class ExternalValidationSpecification extends AsyncSpecification<User> {
  constructor(private readonly externalService: IExternalValidationService) {
    super();
  }

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    const result = await this.externalService.validateUser(user);
    return result.isValid;
  }
}

// Compose async specifications
const asyncUserValidation = new EmailUniquenessSpecification(
  userRepository
).andAsync(new ExternalValidationSpecification(externalService));

// Validate asynchronously
const user = new User('John Doe', 'john@example.com', 25);
const isValid = await asyncUserValidation.isSatisfiedByAsync(user);
```

### Async Rules

```typescript
// Async validation rules
const uniqueEmailRule = Rules.forString()
  .required()
  .email()
  .asyncCustom(async (email: string) => {
    const existingUser = await userRepository.findByEmail(email);
    return existingUser === null;
  })
  .withMessage('Email address already exists')
  .build();

const validDomainRule = Rules.forString()
  .required()
  .asyncCustom(async (domain: string) => {
    const isValid = await domainValidationService.validateDomain(domain);
    return isValid;
  })
  .withMessage('Domain is not valid')
  .build();

// Async validation
const emailValidation = await uniqueEmailRule.validateAsync('john@example.com');
const domainValidation = await validDomainRule.validateAsync('example.com');
```

### Async Domain Validators

```typescript
// Async domain validator
const asyncUserValidator = DomainValidator.create<User>()
  .forProperty('name', Rules.forString().required().minLength(2))
  .forProperty('email', uniqueEmailRule)
  .forProperty(
    'username',
    Rules.forString()
      .required()
      .asyncCustom(async (username: string) => {
        const exists = await userRepository.existsByUsername(username);
        return !exists;
      })
  )
  .build();

// Async validation
const user = new User('John Doe', 'john@example.com', 25);
const validation = await asyncUserValidator.validateAsync(user);

if (!validation.isValid) {
  console.log('Async validation errors:');
  validation.errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
}
```

## 🔧 Validation Context

### Context Creation

```typescript
import { ValidationContext } from '@vytches-ddd/validation';

// Create validation context
const context = ValidationContext.create()
  .withUserId('user-123')
  .withRequestId('req-456')
  .withTenantId('tenant-789')
  .withEnvironment('production')
  .withMetadata({
    feature: 'user-registration',
    version: '1.2.0',
  })
  .build();

// Context-aware validation
const contextualValidator = DomainValidator.create<User>()
  .forProperty('name', Rules.forString().required().minLength(2))
  .forProperty('email', Rules.forString().required().email())
  .forProperty('role', Rules.forEnum(UserRole).required())
  .withContext(context)
  .build();

// Validate with context
const validation = await contextualValidator.validate(user);
```

### Context-Dependent Rules

```typescript
// Rules that depend on context
const contextualAgeRule = Rules.forNumber()
  .required()
  .min(context => (context.metadata.feature === 'admin-registration' ? 21 : 18))
  .withMessage('Age requirement depends on registration type')
  .build();

const environmentalRule = Rules.forString()
  .required()
  .when(context => context.environment === 'production')
  .then(Rules.forString().pattern(/^[A-Z0-9]+$/))
  .otherwise(Rules.forString().minLength(1))
  .build();

// Tenant-specific rules
const tenantRule = Rules.forString()
  .required()
  .asyncCustom(async (value: string, context: ValidationContext) => {
    const tenantConfig = await configService.getTenantConfig(context.tenantId);
    return tenantConfig.allowedValues.includes(value);
  })
  .build();
```

## 🚨 Error Handling

### Validation Error Types

```typescript
// Validation error hierarchy
interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  details?: Record<string, any>;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Specific error types
class RequiredFieldError extends ValidationError {
  constructor(field: string) {
    super({
      field,
      code: 'REQUIRED_FIELD',
      message: `${field} is required`,
      severity: 'ERROR',
    });
  }
}

class InvalidFormatError extends ValidationError {
  constructor(field: string, expectedFormat: string) {
    super({
      field,
      code: 'INVALID_FORMAT',
      message: `${field} must be in ${expectedFormat} format`,
      severity: 'ERROR',
    });
  }
}
```

### Error Handling Patterns

```typescript
// Comprehensive error handling
const userValidator = DomainValidator.create<User>()
  .forProperty('name', Rules.forString().required().minLength(2))
  .forProperty('email', Rules.forString().required().email())
  .forProperty('age', Rules.forNumber().required().min(18))
  .build();

// Validate and handle errors
const validation = await userValidator.validate(user);

if (!validation.isValid) {
  // Group errors by field
  const errorsByField = validation.errors.reduce(
    (acc, error) => {
      if (!acc[error.field]) {
        acc[error.field] = [];
      }
      acc[error.field].push(error);
      return acc;
    },
    {} as Record<string, ValidationError[]>
  );

  // Handle each field's errors
  Object.entries(errorsByField).forEach(([field, errors]) => {
    console.log(`Errors for ${field}:`);
    errors.forEach(error => {
      console.log(`  - ${error.message} (${error.code})`);
    });
  });

  // Handle by severity
  const criticalErrors = validation.errors.filter(e => e.severity === 'ERROR');
  const warnings = validation.errors.filter(e => e.severity === 'WARNING');

  if (criticalErrors.length > 0) {
    throw new ValidationException('Critical validation errors', criticalErrors);
  }

  if (warnings.length > 0) {
    console.warn('Validation warnings:', warnings);
  }
}
```

### Custom Error Messages

```typescript
// Custom error messages
const customMessageValidator = DomainValidator.create<User>()
  .forProperty(
    'name',
    Rules.forString()
      .required()
      .withMessage('Full name is required')
      .minLength(2)
      .withMessage('Name must be at least 2 characters')
  )
  .forProperty(
    'email',
    Rules.forString()
      .required()
      .withMessage('Email address is required')
      .email()
      .withMessage('Please provide a valid email address')
  )
  .forProperty(
    'age',
    Rules.forNumber()
      .required()
      .withMessage('Age is required')
      .min(18)
      .withMessage('You must be at least 18 years old')
  )
  .build();

// Localized error messages
const localizedValidator = DomainValidator.create<User>()
  .forProperty(
    'name',
    Rules.forString()
      .required()
      .withMessage('validation.name.required')
      .minLength(2)
      .withMessage('validation.name.min_length')
  )
  .withLocalizationService(localizationService)
  .build();
```

## 🛠️ Custom Validators

### Custom Specification

```typescript
// Custom domain-specific specification
class ValidBusinessEmailSpecification extends Specification<User> {
  constructor(private readonly businessDomains: string[]) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    const domain = user.email.split('@')[1];
    return this.businessDomains.includes(domain);
  }
}

// Custom credit score specification
class CreditScoreSpecification extends Specification<LoanApplication> {
  constructor(private readonly minimumScore: number) {
    super();
  }

  isSatisfiedBy(application: LoanApplication): boolean {
    return application.creditScore >= this.minimumScore;
  }
}

// Usage
const businessDomains = ['company.com', 'enterprise.org', 'business.net'];
const businessEmailSpec = new ValidBusinessEmailSpecification(businessDomains);
const creditSpec = new CreditScoreSpecification(650);

const businessUserValidation = businessEmailSpec.and(
  new UserAgeSpecification(21)
);

const loanValidation = creditSpec.and(
  new IncomeVerificationSpecification(50000)
);
```

### Custom Rules

```typescript
// Custom validation rule
class CustomRule<T> implements IValidationRule<T> {
  constructor(
    private readonly validator: (value: T) => boolean,
    private readonly errorMessage: string,
    private readonly errorCode: string
  ) {}

  validate(value: T): ValidationResult {
    const isValid = this.validator(value);

    if (!isValid) {
      return {
        isValid: false,
        errors: [
          {
            field: '',
            code: this.errorCode,
            message: this.errorMessage,
            severity: 'ERROR',
          },
        ],
      };
    }

    return { isValid: true, errors: [] };
  }
}

// Custom rule factory
const customRuleFactory = {
  palindrome: () =>
    new CustomRule(
      (value: string) => value === value.split('').reverse().join(''),
      'Value must be a palindrome',
      'NOT_PALINDROME'
    ),

  divisibleBy: (divisor: number) =>
    new CustomRule(
      (value: number) => value % divisor === 0,
      `Value must be divisible by ${divisor}`,
      'NOT_DIVISIBLE'
    ),

  uniqueArray: () =>
    new CustomRule(
      (value: any[]) => value.length === new Set(value).size,
      'Array must contain unique values',
      'NOT_UNIQUE'
    ),
};

// Usage
const palindromeRule = customRuleFactory.palindrome();
const divisibleByFiveRule = customRuleFactory.divisibleBy(5);
const uniqueArrayRule = customRuleFactory.uniqueArray();
```

### Custom Async Validators

```typescript
// Custom async validator
class AsyncCustomValidator<T> implements IAsyncValidationRule<T> {
  constructor(
    private readonly asyncValidator: (value: T) => Promise<boolean>,
    private readonly errorMessage: string,
    private readonly errorCode: string
  ) {}

  async validateAsync(value: T): Promise<ValidationResult> {
    const isValid = await this.asyncValidator(value);

    if (!isValid) {
      return {
        isValid: false,
        errors: [
          {
            field: '',
            code: this.errorCode,
            message: this.errorMessage,
            severity: 'ERROR',
          },
        ],
      };
    }

    return { isValid: true, errors: [] };
  }
}

// Custom async rule factory
const asyncRuleFactory = {
  uniqueInDatabase: (repository: IRepository, field: string) =>
    new AsyncCustomValidator(
      async (value: any) => {
        const existing = await repository.findByField(field, value);
        return existing === null;
      },
      `${field} already exists`,
      'NOT_UNIQUE_IN_DATABASE'
    ),

  validWithExternalService: (service: IExternalValidationService) =>
    new AsyncCustomValidator(
      async (value: any) => {
        const result = await service.validate(value);
        return result.isValid;
      },
      'External validation failed',
      'EXTERNAL_VALIDATION_FAILED'
    ),
};
```

## 🔗 Integration Patterns

### CQRS Integration

```typescript
// Command validation
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly userValidator: DomainValidator<User>
  ) {}

  async handle(
    command: CreateUserCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Create user from command
    const user = User.create(command.name, command.email, command.age);

    // Validate user
    const validation = await this.userValidator.validate(user);

    if (!validation.isValid) {
      throw new ValidationException(
        'User validation failed',
        validation.errors
      );
    }

    // Save valid user
    await this.userRepository.save(user);
  }
}

// Query validation
@QueryHandler(GetUsersByAgeRangeQuery)
export class GetUsersByAgeRangeQueryHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly queryValidator: DomainValidator<GetUsersByAgeRangeQuery>
  ) {}

  async handle(query: GetUsersByAgeRangeQuery): Promise<User[]> {
    // Validate query
    const validation = await this.queryValidator.validate(query);

    if (!validation.isValid) {
      throw new ValidationException(
        'Query validation failed',
        validation.errors
      );
    }

    // Execute valid query
    return await this.userRepository.findByAgeRange(query.minAge, query.maxAge);
  }
}
```

### Policy Integration

```typescript
// Validation with policies
import { PolicyBuilder } from '@vytches-ddd/policies';

// Create policy with validation
const userCreationPolicy = PolicyBuilder.create<User>()
  .withId('user-creation-policy')
  .withDomain('user-management')
  .must(new UserAgeSpecification(18))
  .and()
  .must(new UserEmailSpecification())
  .and()
  .must(
    new AsyncSpecification(async (user: User) => {
      const validation = await userValidator.validate(user);
      return validation.isValid;
    })
  )
  .build();

// Use in service
class UserService {
  async createUser(userData: CreateUserData): Promise<User> {
    const user = User.create(userData.name, userData.email, userData.age);

    // Validate with policy
    const policyResult = await userCreationPolicy.check({
      entity: user,
      context,
    });

    if (policyResult.isFailure()) {
      throw new PolicyViolationError(
        'User creation policy failed',
        policyResult.violations
      );
    }

    return await this.userRepository.save(user);
  }
}
```

### Repository Integration

```typescript
// Repository with validation
class ValidatingUserRepository extends BaseRepository<User> {
  constructor(
    eventBus: IEventBus,
    storageAdapter: IStorageAdapter<User>,
    private readonly userValidator: DomainValidator<User>
  ) {
    super(eventBus, storageAdapter);
  }

  async save(user: User): Promise<void> {
    // Validate before saving
    const validation = await this.userValidator.validate(user);

    if (!validation.isValid) {
      throw new ValidationException(
        'Cannot save invalid user',
        validation.errors
      );
    }

    // Save valid user
    await super.save(user);
  }
}
```

## 🧪 Testing

### Specification Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('UserAgeSpecification', () => {
  it('should pass for users of legal age', () => {
    // Arrange
    const spec = new UserAgeSpecification(18);
    const user = new User('John Doe', 'john@example.com', 25);

    // Act
    const result = spec.isSatisfiedBy(user);

    // Assert
    expect(result).toBe(true);
  });

  it('should fail for underage users', () => {
    // Arrange
    const spec = new UserAgeSpecification(18);
    const user = new User('Jane Doe', 'jane@example.com', 17);

    // Act
    const result = spec.isSatisfiedBy(user);

    // Assert
    expect(result).toBe(false);
  });
});

describe('Composite Specifications', () => {
  it('should combine specifications with AND', () => {
    // Arrange
    const ageSpec = new UserAgeSpecification(18);
    const emailSpec = new UserEmailSpecification();
    const combined = ageSpec.and(emailSpec);

    const validUser = new User('John Doe', 'john@example.com', 25);
    const invalidUser = new User('Jane Doe', 'invalid-email', 25);

    // Act & Assert
    expect(combined.isSatisfiedBy(validUser)).toBe(true);
    expect(combined.isSatisfiedBy(invalidUser)).toBe(false);
  });
});
```

### Rule Testing

```typescript
describe('Fluent Rules', () => {
  it('should validate string rules', () => {
    // Arrange
    const rule = Rules.forString()
      .required()
      .minLength(2)
      .maxLength(50)
      .pattern(/^[A-Za-z\s]+$/)
      .build();

    // Act & Assert
    expect(rule.validate('John Doe').isValid).toBe(true);
    expect(rule.validate('J').isValid).toBe(false); // Too short
    expect(rule.validate('John123').isValid).toBe(false); // Invalid pattern
    expect(rule.validate('').isValid).toBe(false); // Required
  });

  it('should validate number rules', () => {
    // Arrange
    const rule = Rules.forNumber().required().min(18).max(120).build();

    // Act & Assert
    expect(rule.validate(25).isValid).toBe(true);
    expect(rule.validate(17).isValid).toBe(false); // Too low
    expect(rule.validate(121).isValid).toBe(false); // Too high
  });
});
```

### Async Validation Testing

```typescript
describe('Async Validation', () => {
  it('should validate async specifications', async () => {
    // Arrange
    const mockRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
    };

    const spec = new EmailUniquenessSpecification(mockRepository);
    const user = new User('John Doe', 'john@example.com', 25);

    // Act
    const result = await spec.isSatisfiedByAsync(user);

    // Assert
    expect(result).toBe(true);
    expect(mockRepository.findByEmail).toHaveBeenCalledWith('john@example.com');
  });

  it('should handle async validation errors', async () => {
    // Arrange
    const mockRepository = {
      findByEmail: jest.fn().mockRejectedValue(new Error('Database error')),
    };

    const spec = new EmailUniquenessSpecification(mockRepository);
    const user = new User('John Doe', 'john@example.com', 25);

    // Act & Assert
    await expect(spec.isSatisfiedByAsync(user)).rejects.toThrow(
      'Database error'
    );
  });
});
```

## 🏆 Best Practices

### Specification Design

```typescript
// ✅ Good: Single responsibility
class UserAgeSpecification extends Specification<User> {
  constructor(private readonly minAge: number) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.age >= this.minAge;
  }
}

// ❌ Bad: Multiple responsibilities
class UserValidationSpecification extends Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.age >= 18 && user.email.includes('@') && user.name.length > 0;
  }
}
```

### Rule Composition

```typescript
// ✅ Good: Composable rules
const nameRule = Rules.forString().required().minLength(2);
const emailRule = Rules.forString().required().email();
const ageRule = Rules.forNumber().required().min(18);

const userValidator = DomainValidator.create<User>()
  .forProperty('name', nameRule)
  .forProperty('email', emailRule)
  .forProperty('age', ageRule)
  .build();

// ❌ Bad: Monolithic validation
const massiveValidator = DomainValidator.create<User>()
  .forProperty(
    'everything',
    Rules.forObject().custom(user => {
      // Complex validation logic mixed together
      return user.name && user.email && user.age >= 18;
    })
  )
  .build();
```

### Error Handling

```typescript
// ✅ Good: Specific error handling
const validation = await userValidator.validate(user);

if (!validation.isValid) {
  const requiredErrors = validation.errors.filter(
    e => e.code === 'REQUIRED_FIELD'
  );
  const formatErrors = validation.errors.filter(
    e => e.code === 'INVALID_FORMAT'
  );

  if (requiredErrors.length > 0) {
    throw new RequiredFieldsError(requiredErrors);
  }

  if (formatErrors.length > 0) {
    throw new InvalidFormatError(formatErrors);
  }
}

// ❌ Bad: Generic error handling
const validation = await userValidator.validate(user);
if (!validation.isValid) {
  throw new Error('Validation failed');
}
```

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/PawelGozdz/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches-ddd/validation

# Run tests
pnpm test --filter=@vytches-ddd/validation

# Run in development mode
pnpm dev --filter=@vytches-ddd/validation
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches-ddd](https://github.com/PawelGozdz/vytches-ddd)
ecosystem**

For more information, visit the [main documentation](../../README.md).
