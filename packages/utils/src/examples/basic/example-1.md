# Result Pattern Fundamentals

**Version**: 1.0.0 **Package**: @vytches-ddd/utils **Complexity**: basic
**Domain**: Infrastructure **Patterns**: Result pattern, functional error
handling, type safety **Dependencies**: None

## Description

The Result pattern is a functional programming approach to error handling that
makes errors explicit and forces proper error handling without throwing
exceptions. This example demonstrates the fundamentals of using the Result class
for type-safe error handling.

## Business Context

Traditional exception-based error handling can lead to:

- Hidden control flow paths
- Forgotten error handling
- Runtime crashes from unhandled exceptions
- Difficulty in understanding what operations might fail

The Result pattern solves these problems by making success and failure explicit
in the type system, ensuring errors are always handled.

## Code Example

```typescript
// result-basics.ts
import { Result } from '@vytches-ddd/utils';
import { UserData, ValidationError, ApiResponse } from '../types';

// ✅ FOCUS: Basic Result pattern usage
export class UserValidationService {
  // Creating successful results
  validateUser(userData: UserData): Result<UserData, ValidationError> {
    if (!userData.email || !userData.email.includes('@')) {
      return Result.fail<UserData, ValidationError>({
        field: 'email',
        message: 'Invalid email format',
        value: userData.email,
      });
    }

    if (!userData.name || userData.name.trim().length < 2) {
      return Result.fail<UserData, ValidationError>({
        field: 'name',
        message: 'Name must be at least 2 characters',
        value: userData.name,
      });
    }

    return Result.ok(userData);
  }

  // Working with Result pattern
  processUserRegistration(userData: UserData): Result<string, ValidationError> {
    const validationResult = this.validateUser(userData);

    if (validationResult.isFailure) {
      return Result.fail(validationResult.error);
    }

    const validUser = validationResult.value;
    const userId = `user-${Date.now()}`;

    return Result.ok(`User ${validUser.name} registered with ID: ${userId}`);
  }

  // Using Result.try for exception handling
  parseUserJson(jsonString: string): Result<UserData, Error> {
    return Result.try(() => {
      const parsed = JSON.parse(jsonString);
      return parsed as UserData;
    });
  }

  // Pattern matching with Result
  formatUserInfo(userData: UserData): string {
    const result = this.validateUser(userData);

    return result.match(
      user => `Valid user: ${user.name} (${user.email})`,
      error => `Validation failed: ${error.message}`
    );
  }

  // Chaining operations with map
  getUserDisplayName(userData: UserData): Result<string, ValidationError> {
    return this.validateUser(userData)
      .map(user => user.name.trim())
      .map(name => `Mr/Ms. ${name}`);
  }

  // Multiple operations with flatMap
  processAndFormatUser(userData: UserData): Result<string, ValidationError> {
    return this.validateUser(userData).flatMap(user => {
      if (user.role === 'admin') {
        return Result.ok(`ADMIN: ${user.name}`);
      }
      return Result.ok(`USER: ${user.name}`);
    });
  }
}
```

## Key Features

- **Explicit Error Handling**: Errors are part of the type signature
- **Type Safety**: TypeScript enforces proper error handling
- **Functional Composition**: Chain operations safely with `map` and `flatMap`
- **Pattern Matching**: Handle success and failure cases explicitly
- **Exception Wrapping**: Convert throwing code to Result pattern with
  `Result.try`

## Usage Examples

```typescript
const service = new UserValidationService();

// Basic usage
const userData: UserData = {
  id: '1',
  email: 'john@example.com',
  name: 'John Doe',
  role: 'user',
  createdAt: new Date(),
};

const result = service.validateUser(userData);

if (result.isSuccess) {
  console.log('User is valid:', result.value);
} else {
  console.error('Validation error:', result.error);
}

// Chaining operations
const displayResult = service.getUserDisplayName(userData);
displayResult
  .tap(name => console.log('Display name:', name))
  .tapError(error => console.error('Failed:', error.message));
```

## Common Pitfalls

- **Forgetting to check `isSuccess`**: Always check before accessing `value`
- **Accessing value on failure**: Will throw an error - use type guards
- **Mixing exceptions with Result**: Be consistent - either use Result or
  exceptions
- **Not using `Result.try`**: Wrap throwing code properly

## Related Examples

- [Advanced Result Patterns](../intermediate/example-1.md)
- [Async Result Patterns](../intermediate/example-2.md)
- [NestJS Basic Manual Setup](../frameworks/nestjs/basic/example-1.md)
