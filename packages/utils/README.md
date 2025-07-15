# @vytches-ddd/utils

<!-- LLM-METADATA
Package: @vytches-ddd/utils
Category: Utility
Purpose: Common utilities and helper functions including Result pattern, safeRun testing utility, and LibUtils for validation and type checking
Dependencies: uuid
Complexity: Low
DDD Patterns: Result Pattern, Functional Error Handling, Utility Functions
Integration Points: All packages use these utilities for error handling and validation
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Futils.svg)](https://badge.fury.io/js/%40vytches-ddd%2Futils)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Essential utilities and helper functions for functional programming and Domain-Driven Design**

Core utility package providing the Result pattern for functional error handling, safeRun testing utility, and LibUtils for validation and type checking. These utilities form the foundation for all other packages in the VytchesDDD ecosystem.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Result Pattern](#result-pattern)
- [SafeRun Testing Utility](#saferun-testing-utility)
- [LibUtils](#libutils)
- [Error Handling](#error-handling)
- [Validation](#validation)
- [Type Checking](#type-checking)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/utils

# yarn
yarn add @vytches-ddd/utils

# pnpm
pnpm add @vytches-ddd/utils
```

### Dependencies

```bash
# UUID library for identifier generation
npm install uuid
```

## ✨ Key Features

### Result Pattern
- **Functional Error Handling**: Avoid exceptions with Result<T, E> pattern
- **Composable Operations**: Chain operations with map, flatMap, and match
- **Async Support**: Full async/await support with tryAsync and mapAsync
- **Type Safety**: Strict TypeScript typing for success and error cases

### Testing Utilities
- **SafeRun**: Functional error handling for tests without try/catch
- **Type-Safe Testing**: Proper error handling in test scenarios
- **Async Support**: Works with both sync and async operations
- **Clean Test Code**: Eliminates boilerplate try/catch blocks

### LibUtils
- **Validation**: UUID, integer, bigint, and text ID validation
- **Type Checking**: Comprehensive empty/truthy/falsy checking
- **Utilities**: Sleep, deep equality, and normalization functions
- **UUID Generation**: V4 UUID generation with validation

## 🎯 Core Concepts

### Result Pattern

The Result pattern provides a functional approach to error handling:

```typescript
// Result interface
class Result<TValue, TError = Error> {
  readonly isSuccess: boolean;
  readonly isFailure: boolean;
  readonly value: TValue;      // Available if isSuccess
  readonly error: TError;      // Available if isFailure
  
  // Factory methods
  static ok<T>(value: T): Result<T, Error>
  static fail<T>(error: Error): Result<T, Error>
  static try<T>(fn: () => T): Result<T, Error>
  static tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>>
  
  // Transformation methods
  map<U>(fn: (value: TValue) => U): Result<U, TError>
  flatMap<U>(fn: (value: TValue) => Result<U, TError>): Result<U, TError>
  match<U>(onSuccess: (value: TValue) => U, onFailure: (error: TError) => U): U
}
```

### SafeRun Pattern

SafeRun provides error handling for testing scenarios:

```typescript
// Synchronous version
function safeRun<E extends Error, T>(fn: () => T): readonly [E | undefined, T | undefined]

// Asynchronous version  
function safeRun<E extends Error, T>(fn: () => Promise<T>): Promise<readonly [E | undefined, T | undefined]>
```

### LibUtils

LibUtils provides essential utility functions:

```typescript
class LibUtils {
  // UUID utilities
  static getUUID(type?: 'v4'): string
  static isValidUUID(value: string): boolean
  
  // Validation utilities
  static isValidInteger(value: number): boolean
  static isValidBigInt(value: string): boolean
  static isValidTextId(value: string): boolean
  
  // Type checking utilities
  static isEmpty(input: unknown): boolean
  static hasValue(input: unknown): boolean
  static isTruthy(input: unknown): boolean
  static isFalsy(input: unknown): boolean
  
  // Utility functions
  static sleep(ms: number): Promise<void>
  static deepEqual(obj1: unknown, obj2: unknown): boolean
  static normalizeIdToString(value: string | number | bigint): string
}
```

## 🚀 Quick Start

### Basic Result Usage

```typescript
import { Result } from '@vytches-ddd/utils';

// Creating results
const success = Result.ok('Hello, World!');
const failure = Result.fail(new Error('Something went wrong'));

// Checking results
if (success.isSuccess) {
  console.log(success.value); // "Hello, World!"
}

if (failure.isFailure) {
  console.log(failure.error.message); // "Something went wrong"
}

// Using try for automatic error handling
const result = Result.try(() => {
  return JSON.parse('{"name": "John"}');
});

if (result.isSuccess) {
  console.log(result.value.name); // "John"
}
```

### Basic SafeRun Usage

```typescript
import { safeRun } from '@vytches-ddd/utils';

// Synchronous error handling
const [error, result] = safeRun(() => {
  return JSON.parse('invalid json');
});

if (error) {
  console.error('Parsing failed:', error.message);
} else {
  console.log('Parsed successfully:', result);
}

// Asynchronous error handling
const [asyncError, asyncResult] = await safeRun(async () => {
  const response = await fetch('/api/data');
  return await response.json();
});

if (asyncError) {
  console.error('API call failed:', asyncError.message);
} else {
  console.log('API response:', asyncResult);
}
```

### Basic LibUtils Usage

```typescript
import { LibUtils } from '@vytches-ddd/utils';

// UUID generation and validation
const id = LibUtils.getUUID();
console.log(LibUtils.isValidUUID(id)); // true

// Type checking
console.log(LibUtils.isEmpty('')); // true
console.log(LibUtils.hasValue('hello')); // true
console.log(LibUtils.isTruthy(42)); // true
console.log(LibUtils.isFalsy(0)); // true

// Validation
console.log(LibUtils.isValidInteger(42)); // true
console.log(LibUtils.isValidBigInt('123456789')); // true
console.log(LibUtils.isValidTextId('user_123')); // true
```

## 🎯 Result Pattern

### Creating Results

```typescript
import { Result } from '@vytches-ddd/utils';

// Success results
const successResult = Result.ok('Success value');
const voidResult = Result.ok(); // For operations that don't return values

// Failure results
const failureResult = Result.fail(new Error('Operation failed'));
const customError = Result.fail(new ValidationError('Invalid input'));

// Try pattern for automatic error handling
const parseResult = Result.try(() => {
  return JSON.parse('{"valid": "json"}');
});

// Async try pattern
const asyncResult = await Result.tryAsync(async () => {
  const response = await fetch('/api/endpoint');
  return await response.json();
});
```

### Transforming Results

```typescript
import { Result } from '@vytches-ddd/utils';

// Map transforms success values
const numberResult = Result.ok(42);
const stringResult = numberResult.map(n => n.toString()); // Result<string, Error>

// FlatMap chains operations that return Results
const userResult = Result.ok('user123');
const profileResult = userResult.flatMap(userId => {
  return Result.try(() => getUserProfile(userId));
});

// Match handles both success and failure cases
const message = numberResult.match(
  value => `Success: ${value}`,
  error => `Error: ${error.message}`
);
```

### Async Result Operations

```typescript
import { Result } from '@vytches-ddd/utils';

// Async transformation
const dataResult = Result.ok({ id: 123 });
const enrichedResult = await dataResult.mapAsync(async (data) => {
  const additionalData = await fetchAdditionalData(data.id);
  return { ...data, ...additionalData };
});

// Async chaining
const processedResult = await dataResult.flatMapAsync(async (data) => {
  try {
    const processed = await processData(data);
    return Result.ok(processed);
  } catch (error) {
    return Result.fail(error as Error);
  }
});
```

### Side Effects

```typescript
import { Result } from '@vytches-ddd/utils';

const result = Result.ok('Success value');

// Side effects on success
result.tap(value => {
  console.log('Operation succeeded:', value);
});

// Side effects on failure
result.tapError(error => {
  console.error('Operation failed:', error.message);
});

// Chaining side effects
result
  .tap(value => console.log('Success:', value))
  .tapError(error => console.error('Error:', error))
  .map(value => value.toUpperCase());
```

## 🧪 SafeRun Testing Utility

### Synchronous Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

describe('UserService', () => {
  it('should create user successfully', () => {
    const [error, user] = safeRun(() => {
      return userService.createUser({ name: 'John', email: 'john@example.com' });
    });

    expect(error).toBeUndefined();
    expect(user).toBeDefined();
    expect(user?.name).toBe('John');
  });

  it('should handle validation errors', () => {
    const [validationError] = safeRun(() => {
      return userService.createUser({ name: '', email: 'invalid' });
    });

    expect(validationError).toBeInstanceOf(ValidationError);
    expect(validationError?.message).toContain('Invalid email');
  });
});
```

### Asynchronous Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

describe('UserRepository', () => {
  it('should save user to database', async () => {
    const [error, savedUser] = await safeRun(async () => {
      return await userRepository.save(user);
    });

    expect(error).toBeUndefined();
    expect(savedUser).toBeDefined();
    expect(savedUser?.id).toBeTruthy();
  });

  it('should handle database errors', async () => {
    const [dbError] = await safeRun(async () => {
      return await userRepository.save(invalidUser);
    });

    expect(dbError).toBeInstanceOf(DatabaseError);
    expect(dbError?.message).toContain('Constraint violation');
  });
});
```

### Advanced Testing Patterns

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

describe('PaymentService', () => {
  it('should process payment with retry logic', async () => {
    let attemptCount = 0;
    
    const [error, result] = await safeRun(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new TransientError('Network timeout');
      }
      return { transactionId: 'tx_123', status: 'completed' };
    });

    expect(error).toBeUndefined();
    expect(result?.status).toBe('completed');
    expect(attemptCount).toBe(3);
  });

  it('should handle permanent failures', async () => {
    const [paymentError] = await safeRun(async () => {
      throw new PaymentError('Insufficient funds', 'INSUFFICIENT_FUNDS');
    });

    expect(paymentError).toBeInstanceOf(PaymentError);
    expect(paymentError?.code).toBe('INSUFFICIENT_FUNDS');
  });
});
```

## 🔧 LibUtils

### UUID Operations

```typescript
import { LibUtils } from '@vytches-ddd/utils';

// Generate UUIDs
const uuid = LibUtils.getUUID(); // Default v4
const v4uuid = LibUtils.getUUID('v4'); // Explicit v4

// Validate UUIDs
const isValid = LibUtils.isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
const isInvalid = LibUtils.isValidUUID('not-a-uuid'); // false

// Usage in domain objects
class User {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {
    if (!LibUtils.isValidUUID(id)) {
      throw new Error('Invalid user ID format');
    }
  }

  static create(name: string): User {
    return new User(LibUtils.getUUID(), name);
  }
}
```

### Validation Functions

```typescript
import { LibUtils } from '@vytches-ddd/utils';

// Integer validation
const isValidAge = LibUtils.isValidInteger(25); // true
const isInvalidAge = LibUtils.isValidInteger(-5); // false (negative)
const isNotInteger = LibUtils.isValidInteger(3.14); // false (decimal)

// BigInt validation
const isValidBigInt = LibUtils.isValidBigInt('123456789012345678901234567890'); // true
const isInvalidBigInt = LibUtils.isValidBigInt('not_a_number'); // false

// Text ID validation (alphanumeric, underscore, dash)
const isValidTextId = LibUtils.isValidTextId('user_123'); // true
const isValidKebabId = LibUtils.isValidTextId('user-123'); // true
const isInvalidTextId = LibUtils.isValidTextId('user@123'); // false

// Usage in EntityId validation
class EntityId {
  constructor(private readonly value: string) {
    if (!LibUtils.isValidUUID(value) && !LibUtils.isValidTextId(value)) {
      throw new Error('Invalid entity ID format');
    }
  }

  static fromInteger(value: number): EntityId {
    if (!LibUtils.isValidInteger(value)) {
      throw new Error('Invalid integer ID');
    }
    return new EntityId(value.toString());
  }
}
```

### Type Checking Functions

```typescript
import { LibUtils } from '@vytches-ddd/utils';

// Empty checking
console.log(LibUtils.isEmpty('')); // true
console.log(LibUtils.isEmpty([])); // true
console.log(LibUtils.isEmpty({})); // true
console.log(LibUtils.isEmpty(null)); // true
console.log(LibUtils.isEmpty(undefined)); // true
console.log(LibUtils.isEmpty(0)); // true
console.log(LibUtils.isEmpty(false)); // true

// Has value checking
console.log(LibUtils.hasValue('hello')); // true
console.log(LibUtils.hasValue([1, 2, 3])); // true
console.log(LibUtils.hasValue({ key: 'value' })); // true
console.log(LibUtils.hasValue(42)); // true
console.log(LibUtils.hasValue(true)); // true

// Truthy/falsy checking
console.log(LibUtils.isTruthy('hello')); // true
console.log(LibUtils.isTruthy(42)); // true
console.log(LibUtils.isTruthy([])); // false (empty array)
console.log(LibUtils.isTruthy({})); // false (empty object)

console.log(LibUtils.isFalsy('')); // true
console.log(LibUtils.isFalsy(0)); // true
console.log(LibUtils.isFalsy(null)); // true
console.log(LibUtils.isFalsy(undefined)); // true
```

### Utility Functions

```typescript
import { LibUtils } from '@vytches-ddd/utils';

// Sleep utility
async function delayedOperation(): Promise<void> {
  console.log('Starting operation...');
  await LibUtils.sleep(1000); // Wait 1 second
  console.log('Operation completed');
}

// Deep equality checking
const obj1 = { name: 'John', age: 30, hobbies: ['reading', 'coding'] };
const obj2 = { name: 'John', age: 30, hobbies: ['reading', 'coding'] };
const obj3 = { name: 'Jane', age: 25, hobbies: ['painting'] };

console.log(LibUtils.deepEqual(obj1, obj2)); // true
console.log(LibUtils.deepEqual(obj1, obj3)); // false

// ID normalization
const stringId = LibUtils.normalizeIdToString('user_123'); // "user_123"
const numberId = LibUtils.normalizeIdToString(42); // "42"
const bigintId = LibUtils.normalizeIdToString(BigInt(123)); // "123"

// Usage in value objects
class EntityId {
  constructor(private readonly value: string | number | bigint) {}

  toString(): string {
    return LibUtils.normalizeIdToString(this.value);
  }

  equals(other: EntityId): boolean {
    return LibUtils.deepEqual(this.value, other.value);
  }
}
```

## 🔗 Integration Patterns

### Repository Pattern with Result

```typescript
import { Result } from '@vytches-ddd/utils';
import { LibUtils } from '@vytches-ddd/utils';

interface IUserRepository {
  findById(id: string): Promise<Result<User, Error>>;
  save(user: User): Promise<Result<User, Error>>;
}

class UserRepository implements IUserRepository {
  async findById(id: string): Promise<Result<User, Error>> {
    if (!LibUtils.isValidUUID(id)) {
      return Result.fail(new Error('Invalid user ID format'));
    }

    return await Result.tryAsync(async () => {
      const userData = await this.database.findUser(id);
      if (!userData) {
        throw new Error('User not found');
      }
      return User.fromData(userData);
    });
  }

  async save(user: User): Promise<Result<User, Error>> {
    return await Result.tryAsync(async () => {
      const savedData = await this.database.saveUser(user.toData());
      return User.fromData(savedData);
    });
  }
}
```

### Domain Service with Validation

```typescript
import { Result, LibUtils } from '@vytches-ddd/utils';

class UserRegistrationService {
  async registerUser(userData: UserRegistrationData): Promise<Result<User, Error>> {
    // Validate input
    if (LibUtils.isEmpty(userData.email)) {
      return Result.fail(new Error('Email is required'));
    }

    if (LibUtils.isEmpty(userData.name)) {
      return Result.fail(new Error('Name is required'));
    }

    return await Result.tryAsync(async () => {
      // Check if user already exists
      const existingUserResult = await this.userRepository.findByEmail(userData.email);
      if (existingUserResult.isSuccess) {
        throw new Error('User already exists');
      }

      // Create new user
      const user = User.create(userData.name, userData.email);
      const saveResult = await this.userRepository.save(user);
      
      if (saveResult.isFailure) {
        throw saveResult.error;
      }

      return saveResult.value;
    });
  }
}
```

### Command Handler with Result Pattern

```typescript
import { Result } from '@vytches-ddd/utils';
import { CommandHandler } from '@vytches-ddd/cqrs';

@CommandHandler(CreateUserCommand)
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<Result<void, Error>> {
    return await Result.tryAsync(async () => {
      // Validate command
      const validationResult = await this.validateCommand(command);
      if (validationResult.isFailure) {
        throw validationResult.error;
      }

      // Execute business logic
      const user = User.create(command.name, command.email);
      const saveResult = await this.userRepository.save(user);
      
      if (saveResult.isFailure) {
        throw saveResult.error;
      }

      // Publish domain event
      await this.eventBus.publish(new UserCreatedEvent(user.id, user.name));
    });
  }

  private async validateCommand(command: CreateUserCommand): Promise<Result<void, Error>> {
    if (LibUtils.isEmpty(command.name)) {
      return Result.fail(new Error('Name is required'));
    }

    if (LibUtils.isEmpty(command.email)) {
      return Result.fail(new Error('Email is required'));
    }

    return Result.ok();
  }
}
```

## 🧪 Testing

### Result Pattern Testing

```typescript
import { describe, it, expect } from 'vitest';
import { Result } from '@vytches-ddd/utils';

describe('Result', () => {
  describe('creation', () => {
    it('should create success result', () => {
      const result = Result.ok('success');
      
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe('success');
    });

    it('should create failure result', () => {
      const error = new Error('failure');
      const result = Result.fail(error);
      
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('transformations', () => {
    it('should map success value', () => {
      const result = Result.ok(42);
      const mapped = result.map(x => x.toString());
      
      expect(mapped.isSuccess).toBe(true);
      expect(mapped.value).toBe('42');
    });

    it('should not map failure value', () => {
      const error = new Error('test');
      const result = Result.fail<number>(error);
      const mapped = result.map(x => x.toString());
      
      expect(mapped.isFailure).toBe(true);
      expect(mapped.error).toBe(error);
    });
  });

  describe('async operations', () => {
    it('should handle async success', async () => {
      const result = await Result.tryAsync(async () => {
        return await Promise.resolve('async success');
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe('async success');
    });

    it('should handle async failure', async () => {
      const result = await Result.tryAsync(async () => {
        throw new Error('async failure');
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error.message).toBe('async failure');
    });
  });
});
```

### SafeRun Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

describe('safeRun', () => {
  describe('synchronous operations', () => {
    it('should handle successful operations', () => {
      const [error, result] = safeRun(() => {
        return 'success';
      });

      expect(error).toBeUndefined();
      expect(result).toBe('success');
    });

    it('should handle failed operations', () => {
      const [error, result] = safeRun(() => {
        throw new Error('test error');
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('test error');
      expect(result).toBeUndefined();
    });
  });

  describe('asynchronous operations', () => {
    it('should handle async success', async () => {
      const [error, result] = await safeRun(async () => {
        return await Promise.resolve('async success');
      });

      expect(error).toBeUndefined();
      expect(result).toBe('async success');
    });

    it('should handle async failure', async () => {
      const [error, result] = await safeRun(async () => {
        throw new Error('async error');
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('async error');
      expect(result).toBeUndefined();
    });
  });
});
```

### LibUtils Testing

```typescript
import { describe, it, expect } from 'vitest';
import { LibUtils } from '@vytches-ddd/utils';

describe('LibUtils', () => {
  describe('UUID operations', () => {
    it('should generate valid UUIDs', () => {
      const uuid = LibUtils.getUUID();
      expect(LibUtils.isValidUUID(uuid)).toBe(true);
    });

    it('should validate UUID format', () => {
      expect(LibUtils.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(LibUtils.isValidUUID('not-a-uuid')).toBe(false);
    });
  });

  describe('type checking', () => {
    it('should check empty values', () => {
      expect(LibUtils.isEmpty('')).toBe(true);
      expect(LibUtils.isEmpty([])).toBe(true);
      expect(LibUtils.isEmpty({})).toBe(true);
      expect(LibUtils.isEmpty(null)).toBe(true);
      expect(LibUtils.isEmpty(undefined)).toBe(true);
      expect(LibUtils.isEmpty('hello')).toBe(false);
    });

    it('should check truthy values', () => {
      expect(LibUtils.isTruthy('hello')).toBe(true);
      expect(LibUtils.isTruthy(42)).toBe(true);
      expect(LibUtils.isTruthy(true)).toBe(true);
      expect(LibUtils.isTruthy('')).toBe(false);
      expect(LibUtils.isTruthy(0)).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate integers', () => {
      expect(LibUtils.isValidInteger(42)).toBe(true);
      expect(LibUtils.isValidInteger(0)).toBe(true);
      expect(LibUtils.isValidInteger(-1)).toBe(false);
      expect(LibUtils.isValidInteger(3.14)).toBe(false);
    });

    it('should validate text IDs', () => {
      expect(LibUtils.isValidTextId('user_123')).toBe(true);
      expect(LibUtils.isValidTextId('user-123')).toBe(true);
      expect(LibUtils.isValidTextId('user@123')).toBe(false);
    });
  });
});
```

## 🎯 Best Practices

### Result Pattern Usage

1. **Use Result for Domain Operations**: Always return Results from domain operations that can fail
2. **Chain Operations**: Use map and flatMap to chain operations without nested error handling
3. **Match Pattern**: Use match() to handle both success and failure cases explicitly
4. **Avoid Throwing**: Don't throw exceptions from Result-returning functions
5. **Type Safety**: Use specific error types instead of generic Error when possible

### SafeRun Testing

1. **Use in Tests Only**: SafeRun is specifically designed for testing scenarios
2. **Clear Variable Names**: Use descriptive variable names for errors (e.g., `validationError`, `dbError`)
3. **Check Both Cases**: Always check both error and success cases
4. **Async Handling**: Use `await safeRun()` for async operations
5. **Specific Error Types**: Test for specific error types, not just generic errors

### LibUtils Best Practices

1. **Validation First**: Always validate inputs before processing
2. **Consistent IDs**: Use consistent ID formats throughout your domain
3. **Type Guards**: Use LibUtils type checking functions as type guards
4. **Performance**: Cache UUID validation results for frequently checked values
5. **Error Messages**: Provide clear error messages when validation fails

### Integration Guidelines

1. **Consistent Error Handling**: Use the same error handling patterns throughout your application
2. **Domain Alignment**: Use Result pattern for domain operations, exceptions for infrastructure
3. **Test Coverage**: Test both success and failure paths thoroughly
4. **Type Safety**: Leverage TypeScript's type system with these utilities
5. **Documentation**: Document expected error types and success values

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build

# Run utils-specific tests
pnpm test:packages:utils
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our [main documentation](../../README.md).