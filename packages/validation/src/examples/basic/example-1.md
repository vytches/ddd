# Basic Specification Pattern Implementation

**Version**: 1.0.0 **Package**: @vytches/ddd-validation **Complexity**: Basic
**Domain**: User Management **Patterns**: Specification Pattern, Field
Validation, Business Rules **Dependencies**: @vytches/ddd-validation,
@vytches/ddd-core

## Description

This example demonstrates basic specification pattern implementation for user
validation using the @vytches/ddd-validation package. It shows how to create
reusable specifications for common validation scenarios and combine them using
logical operators.

## Business Context

User registration systems require validation of email formats, age requirements,
and other business rules. The specification pattern allows for reusable,
composable validation logic that can be tested independently and combined for
complex scenarios.

## Code Example

```typescript
// user-validation-specs.ts
import {
  BaseSpecification,
  ISpecification,
  SpecificationResult,
} from '@vytches/ddd-validation';
import { User } from './types'; // Import from your application

// Email format specification
export class EmailSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): SpecificationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(user.email);

    return {
      isSatisfied: isValid,
      reason: isValid ? undefined : 'Invalid email format',
      metadata: {
        field: 'email',
        value: user.email,
        rule: 'email-format',
      },
    };
  }
}

// Age requirement specification
export class MinimumAgeSpecification extends BaseSpecification<User> {
  constructor(private minimumAge: number) {
    super();
  }

  isSatisfiedBy(user: User): SpecificationResult {
    const isValid = user.age >= this.minimumAge;

    return {
      isSatisfied: isValid,
      reason: isValid
        ? undefined
        : `Must be at least ${this.minimumAge} years old`,
      metadata: {
        field: 'age',
        value: user.age,
        minimumRequired: this.minimumAge,
        rule: 'minimum-age',
      },
    };
  }
}

// Username format specification
export class UsernameSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): SpecificationResult {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    const isValid = usernameRegex.test(user.username);

    return {
      isSatisfied: isValid,
      reason: isValid
        ? undefined
        : 'Username must be 3-20 characters, alphanumeric and underscore only',
      metadata: {
        field: 'username',
        value: user.username,
        rule: 'username-format',
      },
    };
  }
}

// User registration service using specifications
export class UserRegistrationService {
  private emailSpec = new EmailSpecification();
  private ageSpec = new MinimumAgeSpecification(18);
  private usernameSpec = new UsernameSpecification();

  validateUser(user: User): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate email
    const emailResult = this.emailSpec.isSatisfiedBy(user);
    if (!emailResult.isSatisfied) {
      errors.push({
        field: 'email',
        code: 'INVALID_EMAIL',
        message: emailResult.reason!,
        severity: 'error',
      });
    }

    // Validate age
    const ageResult = this.ageSpec.isSatisfiedBy(user);
    if (!ageResult.isSatisfied) {
      errors.push({
        field: 'age',
        code: 'AGE_TOO_LOW',
        message: ageResult.reason!,
        severity: 'error',
      });
    }

    // Validate username
    const usernameResult = this.usernameSpec.isSatisfiedBy(user);
    if (!usernameResult.isSatisfied) {
      errors.push({
        field: 'username',
        code: 'INVALID_USERNAME',
        message: usernameResult.reason!,
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validationDuration: 0,
        rulesApplied: ['email-format', 'minimum-age', 'username-format'],
        skippedRules: [],
        validatorVersion: '1.0.0',
        context: {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'standard',
        },
      },
    };
  }

  // Composite validation using specification combinators
  validateUserWithCompositeSpec(user: User): CompositeSpecificationResult {
    // Combine specifications using AND logic
    const compositeSpec = this.emailSpec
      .and(this.ageSpec)
      .and(this.usernameSpec);

    const result = compositeSpec.isSatisfiedBy(user);
    const individualResults = new Map<string, SpecificationResult>();

    individualResults.set('email', this.emailSpec.isSatisfiedBy(user));
    individualResults.set('age', this.ageSpec.isSatisfiedBy(user));
    individualResults.set('username', this.usernameSpec.isSatisfiedBy(user));

    return {
      isSatisfied: result.isSatisfied,
      results: individualResults,
      aggregatedReason: result.reason,
    };
  }
}

// Usage example
const userService = new UserRegistrationService();

const newUser: User = {
  id: '1',
  email: 'john.doe@example.com',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  age: 25,
  dateOfBirth: new Date('1998-01-01'),
  phoneNumber: '+1234567890',
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    postalCode: '12345',
    country: 'USA',
    isDefault: true,
  },
  preferences: {
    language: 'en',
    timezone: 'UTC',
    currency: 'USD',
    emailNotifications: true,
    smsNotifications: false,
    marketingConsent: false,
  },
  accountStatus: 'pending_verification',
  registrationDate: new Date(),
  lastLoginDate: undefined,
};

// Validate user
const validationResult = userService.validateUser(newUser);
console.log('Validation result:', validationResult.isValid);
console.log('Errors:', validationResult.errors);

// Alternative: Use composite specification
const compositeResult = userService.validateUserWithCompositeSpec(newUser);
console.log('Composite validation:', compositeResult.isSatisfied);
```

## Key Features

- **Reusable Specifications**: Each validation rule is encapsulated in its own
  specification class
- **Composable Logic**: Specifications can be combined using AND, OR, NOT
  operations
- **Rich Metadata**: Each specification provides detailed information about
  validation failures
- **Type Safety**: Full TypeScript support with strongly typed specifications
- **Testable**: Each specification can be unit tested independently

## Common Pitfalls

- **Over-engineering**: Don't create specifications for simple validations that
  won't be reused
- **Tight Coupling**: Avoid creating specifications that depend on external
  services for basic validations
- **Missing Metadata**: Always provide meaningful error messages and metadata
  for debugging
- **Performance**: Be mindful of specification complexity when combining many
  rules

## Related Examples

- [Field-Level Validation Rules](./example-2.md)
- [Real-World Basic Use Cases](./use-case.md)
- [Intermediate Composite Specifications](../intermediate/example-1.md)
