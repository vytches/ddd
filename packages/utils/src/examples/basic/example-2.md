# Safe Execution with safeRun

**Version**: 1.0.0
**Package**: @vytches-ddd/utils
**Complexity**: basic
**Domain**: Infrastructure
**Patterns**: Safe execution, testing utilities, error containment
**Dependencies**: None

## Description

The `safeRun` function provides a safe way to execute functions that might throw exceptions, returning a tuple of `[error, result]` instead of throwing. This is primarily designed for testing scenarios where you want to test error conditions without using try/catch blocks.

## Business Context

In testing scenarios, you often need to:
- Test that functions throw specific errors
- Verify error conditions without crashing tests
- Handle both synchronous and asynchronous operations safely
- Maintain clean test code without nested try/catch blocks

The `safeRun` function simplifies this by providing a consistent interface for safe execution.

## Code Example

```typescript
// safe-execution.ts
import { safeRun } from '@vytches-ddd/utils';
import { UserData, ValidationError, TestScenario, ExecutionContext } from '../types';

// ✅ FOCUS: Safe execution patterns for testing
export class SafeExecutionExample {
  // Function that might throw
  parseUserAge(ageString: string): number {
    const age = parseInt(ageString, 10);
    if (isNaN(age)) {
      throw new Error('Invalid age format');
    }
    if (age < 0 || age > 150) {
      throw new Error('Age must be between 0 and 150');
    }
    return age;
  }

  // Async function that might throw
  async fetchUserData(userId: string): Promise<UserData> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required');
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));

    if (userId === 'invalid') {
      throw new Error('User not found');
    }

    return {
      id: userId,
      email: `user-${userId}@example.com`,
      name: `User ${userId}`,
      role: 'user',
      createdAt: new Date(),
    };
  }

  // Testing synchronous operations with safeRun
  testSyncOperations(): void {
    // Test successful execution
    const [noError, validAge] = safeRun(() => this.parseUserAge('25'));
    if (noError) {
      console.error('Expected success but got error:', noError);
    } else {
      console.log('Valid age:', validAge); // 25
    }

    // Test error conditions
    const [invalidFormatError] = safeRun(() => this.parseUserAge('abc'));
    if (invalidFormatError) {
      console.log('Expected error caught:', invalidFormatError.message);
    }

    const [rangeError] = safeRun(() => this.parseUserAge('200'));
    if (rangeError) {
      console.log('Range error caught:', rangeError.message);
    }
  }

  // Testing asynchronous operations with safeRun
  async testAsyncOperations(): Promise<void> {
    // Test successful async execution
    const [noError, userData] = await safeRun(async () => 
      await this.fetchUserData('123')
    );
    
    if (noError) {
      console.error('Expected success but got error:', noError);
    } else {
      console.log('User data:', userData);
    }

    // Test async error conditions
    const [emptyIdError] = await safeRun(async () => 
      await this.fetchUserData('')
    );
    if (emptyIdError) {
      console.log('Empty ID error:', emptyIdError.message);
    }

    const [notFoundError] = await safeRun(async () => 
      await this.fetchUserData('invalid')
    );
    if (notFoundError) {
      console.log('Not found error:', notFoundError.message);
    }
  }

  // Running test scenarios with safeRun
  runTestScenarios<T>(scenarios: TestScenario<T>[]): void {
    scenarios.forEach(scenario => {
      console.log(`Running scenario: ${scenario.name}`);
      
      const [error, result] = safeRun(() => {
        // Simulate some operation based on input
        if (scenario.shouldFail) {
          throw new Error(scenario.errorType || 'Test error');
        }
        return scenario.expectedOutput as T;
      });

      if (scenario.shouldFail) {
        if (error) {
          console.log(`✅ Expected error caught: ${error.message}`);
        } else {
          console.error(`❌ Expected error but operation succeeded`);
        }
      } else {
        if (error) {
          console.error(`❌ Unexpected error: ${error.message}`);
        } else {
          console.log(`✅ Operation succeeded: ${result}`);
        }
      }
    });
  }

  // Complex execution context testing
  async executeWithContext(context: ExecutionContext): Promise<void> {
    const startTime = Date.now();
    
    const [error, result] = await safeRun(async () => {
      // Simulate operation that might timeout
      const delay = context.timeout || 1000;
      await new Promise(resolve => setTimeout(resolve, delay / 2));
      
      if (context.testName.includes('fail')) {
        throw new Error(`Test failure in ${context.testName}`);
      }
      
      return `Test ${context.testName} completed successfully`;
    });

    const executionTime = Date.now() - startTime;
    
    if (error) {
      console.log(`Test failed after ${executionTime}ms:`, error.message);
    } else {
      console.log(`Test completed after ${executionTime}ms:`, result);
    }
  }
}
```

## Key Features

- **Tuple Return**: Returns `[error, result]` instead of throwing
- **Type Safety**: Properly typed error and result values
- **Async Support**: Works with both sync and async functions
- **Testing Focused**: Designed primarily for test scenarios
- **Clean API**: No try/catch blocks needed in calling code

## Usage Examples

```typescript
const example = new SafeExecutionExample();

// Synchronous safe execution
const [error, age] = safeRun(() => example.parseUserAge('30'));
if (error) {
  console.error('Parse failed:', error.message);
} else {
  console.log('Parsed age:', age);
}

// Asynchronous safe execution
const [asyncError, user] = await safeRun(async () => 
  await example.fetchUserData('user123')
);

if (asyncError) {
  console.error('Fetch failed:', asyncError.message);
} else {
  console.log('Fetched user:', user);
}

// Test scenarios
const scenarios: TestScenario<number>[] = [
  {
    name: 'Valid age',
    input: '25',
    expectedOutput: 25,
    shouldFail: false,
  },
  {
    name: 'Invalid format',
    input: 'abc',
    shouldFail: true,
    errorType: 'Invalid age format',
  },
];

example.runTestScenarios(scenarios);
```

## Common Pitfalls

- **Using in production code**: `safeRun` is designed for testing, use Result pattern for production
- **Ignoring errors**: Always check if the first element (error) is defined
- **Wrong tuple destructuring**: Remember it's `[error, result]`, not `[result, error]`
- **Not awaiting async calls**: Remember to await when using with async functions

## Related Examples

- [Result Pattern Fundamentals](./example-1.md)
- [Error Aggregation Patterns](../intermediate/example-3.md)
- [Library Utilities](./example-3.md)