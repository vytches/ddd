# Basic Implementation Guide

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: basic
**Domain**: Infrastructure **Patterns**: Implementation patterns, service
integration, basic setup **Dependencies**: @vytches/ddd-utils

## Description

This guide demonstrates how to implement basic utility patterns in real
applications. It covers the fundamental approaches to integrating Result
patterns, safe execution, and library utilities into your codebase with clean,
maintainable patterns.

## Business Context

When building applications, you need:

- Consistent error handling strategies
- Reliable utility functions across modules
- Safe execution patterns for critical operations
- Clean separation between business logic and infrastructure

This guide shows how to implement these patterns effectively in your application
architecture.

## Code Example

```typescript
// basic-implementation.ts
import { Result, safeRun, LibUtils } from '@vytches/ddd-utils';
import {
  UserData,
  ValidationError,
  ApiResponse,
  ServiceResponse,
} from '../types';

// ✅ FOCUS: Basic implementation patterns
export class BasicUtilityImplementation {
  // 1. Result Pattern Implementation
  private validateUserInput(
    userData: Partial<UserData>
  ): Result<UserData, ValidationError> {
    // Input validation with Result pattern
    if (LibUtils.isEmpty(userData.email)) {
      return Result.fail({
        field: 'email',
        message: 'Email is required',
        value: userData.email,
      });
    }

    if (!userData.email?.includes('@')) {
      return Result.fail({
        field: 'email',
        message: 'Invalid email format',
        value: userData.email,
      });
    }

    if (
      LibUtils.isEmpty(userData.name) ||
      (userData.name?.trim().length || 0) < 2
    ) {
      return Result.fail({
        field: 'name',
        message: 'Name must be at least 2 characters',
        value: userData.name,
      });
    }

    // Success case with complete user data
    const validUser: UserData = {
      id: userData.id || LibUtils.getUUID(),
      email: userData.email.toLowerCase().trim(),
      name: userData.name!.trim(),
      role: userData.role || 'user',
      createdAt: userData.createdAt || new Date(),
    };

    return Result.ok(validUser);
  }

  // 2. Service Method with Result Pattern
  createUser(userData: Partial<UserData>): Result<UserData, ValidationError> {
    return this.validateUserInput(userData)
      .map(user => ({
        ...user,
        id: LibUtils.getUUID(),
        createdAt: new Date(),
      }))
      .tap(user => {
        // Side effect: logging successful creation
        console.log(`User created: ${user.name} (${user.id})`);
      })
      .tapError(error => {
        // Side effect: logging validation error
        console.error(`User creation failed: ${error.message}`);
      });
  }

  // 3. Async Operation with Result Pattern
  async saveUser(userData: UserData): Promise<Result<UserData, Error>> {
    return await Result.tryAsync(async () => {
      // Simulate database save operation
      await LibUtils.sleep(100);

      // Simulate potential failure
      if (userData.email === 'fail@example.com') {
        throw new Error('Database connection failed');
      }

      return {
        ...userData,
        createdAt: new Date(),
      };
    });
  }

  // 4. Complex Operation Chaining
  async registerUser(
    userData: Partial<UserData>
  ): Promise<ServiceResponse<UserData>> {
    const validationResult = this.createUser(userData);

    if (validationResult.isFailure) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.message,
          details: validationResult.error,
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      };
    }

    const saveResult = await this.saveUser(validationResult.value);

    return saveResult.match(
      user => ({
        success: true,
        data: user,
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
          version: '1.0.0',
        },
      }),
      error => ({
        success: false,
        error: {
          code: 'SAVE_ERROR',
          message: error.message,
          details: error,
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      })
    );
  }

  // 5. Safe Testing Implementation
  testUserOperations(): void {
    const testCases = [
      {
        name: 'Valid user',
        userData: { email: 'john@example.com', name: 'John Doe' },
        shouldSucceed: true,
      },
      {
        name: 'Invalid email',
        userData: { email: 'invalid-email', name: 'John' },
        shouldSucceed: false,
      },
      {
        name: 'Missing name',
        userData: { email: 'john@example.com', name: '' },
        shouldSucceed: false,
      },
    ];

    console.log('\nRunning User Operation Tests:');

    testCases.forEach(testCase => {
      console.log(`\nTest: ${testCase.name}`);

      const [error, result] = safeRun(() => this.createUser(testCase.userData));

      if (error) {
        console.error(`Unexpected error in test: ${error.message}`);
        return;
      }

      if (testCase.shouldSucceed) {
        if (result?.isSuccess) {
          console.log('✅ Test passed - user created successfully');
        } else {
          console.log(
            `❌ Test failed - expected success but got: ${result?.error.message}`
          );
        }
      } else {
        if (result?.isFailure) {
          console.log(
            `✅ Test passed - validation failed as expected: ${result.error.message}`
          );
        } else {
          console.log(
            '❌ Test failed - expected validation error but operation succeeded'
          );
        }
      }
    });
  }

  // 6. Utility Functions Integration
  processUserBatch(users: Partial<UserData>[]): ServiceResponse<UserData[]> {
    const results: UserData[] = [];
    const errors: ValidationError[] = [];

    users.forEach((userData, index) => {
      const result = this.createUser(userData);

      if (result.isSuccess) {
        results.push(result.value);
      } else {
        errors.push({
          ...result.error,
          field: `user[${index}].${result.error.field}`,
        });
      }
    });

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'BATCH_VALIDATION_ERROR',
          message: `${errors.length} validation errors occurred`,
          details: errors,
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      };
    }

    return {
      success: true,
      data: results,
      metadata: {
        timestamp: new Date(),
        requestId: LibUtils.getUUID(),
        version: '1.0.0',
        processedCount: results.length,
      },
    };
  }

  // 7. Configuration and Setup
  configureService(options: {
    validateEmail: boolean;
    generateIds: boolean;
  }): void {
    console.log('Configuring Basic Utility Service:');
    console.log('Options:', options);

    if (options.generateIds) {
      const sampleId = LibUtils.getUUID();
      console.log('Sample ID generation:', sampleId);
    }

    if (options.validateEmail) {
      const testEmail = 'test@example.com';
      console.log(
        `Email validation for "${testEmail}": ${testEmail.includes('@')}`
      );
    }
  }
}
```

## Implementation Steps

### 1. Set Up Result Pattern

```typescript
// Always return Result types for operations that can fail
function validateData(input: unknown): Result<ValidatedData, ValidationError> {
  // Implementation using Result.ok() and Result.fail()
}
```

### 2. Integrate Safe Execution

```typescript
// Use safeRun for testing error conditions
const [error, result] = safeRun(() => functionThatMightThrow());
```

### 3. Leverage Library Utilities

```typescript
// Use LibUtils for common operations
const id = LibUtils.getUUID();
const isEmpty = LibUtils.isEmpty(value);
const isValid = LibUtils.isValidUUID(id);
```

### 4. Handle Async Operations

```typescript
// Use Result.tryAsync for async operations
const result = await Result.tryAsync(async () => await asyncOperation());
```

### 5. Chain Operations

```typescript
// Chain operations with map and flatMap
return validateInput(data).map(processData).flatMap(saveData);
```

## Key Benefits

- **Consistent Error Handling**: Result pattern ensures errors are handled
  uniformly
- **Type Safety**: TypeScript enforces proper error handling at compile time
- **Testability**: Safe execution makes testing error conditions straightforward
- **Maintainability**: Clear patterns make code easier to understand and modify
- **Reliability**: Utility functions provide tested, consistent behavior

## Best Practices

- **Always handle both success and failure cases** when using Result pattern
- **Use Result.try and Result.tryAsync** to wrap potentially throwing operations
- **Leverage LibUtils** for common operations instead of reimplementing
- **Keep side effects in tap/tapError methods** to maintain functional purity
- **Test error conditions** using safeRun to ensure proper error handling

## Common Mistakes

- **Not checking isSuccess/isFailure** before accessing value/error
- **Mixing Result pattern with throwing exceptions** in the same codebase
- **Using safeRun in production code** - it's designed for testing
- **Not utilizing utility functions** and reimplementing common operations

## Related Examples

- [Result Pattern Fundamentals](./example-1.md)
- [Safe Execution with safeRun](./example-2.md)
- [Library Utilities](./example-3.md)
- [Advanced Result Patterns](../intermediate/example-1.md)
