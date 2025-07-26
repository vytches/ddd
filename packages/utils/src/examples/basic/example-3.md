# Library Utilities

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: basic
**Domain**: Infrastructure **Patterns**: Utility functions, validation, helpers,
UUID generation **Dependencies**: uuid

## Description

The `LibUtils` class provides essential utility functions for common operations
like UUID generation, validation, type checking, and object comparison. These
utilities support the core functionality of the @vytches/ddd-core library and
provide helpful functions for general development tasks.

## Business Context

Every application needs basic utility functions for:

- Generating unique identifiers (UUIDs)
- Validating data formats and types
- Checking if values are empty, truthy, or falsy
- Comparing objects for equality
- Performing common operations safely

The `LibUtils` class centralizes these operations with consistent, well-tested
implementations.

## Code Example

```typescript
// library-utilities.ts
import { LibUtils } from '@vytches/ddd-utils';
import { UserData, UtilityOptions, CacheConfig } from '../types';

// ✅ FOCUS: Core utility functions usage
export class UtilityService {
  // UUID generation
  generateUniqueIdentifiers(): void {
    // Generate UUID v4 (default)
    const uuid1 = LibUtils.getUUID();
    const uuid2 = LibUtils.getUUID('v4');

    console.log('Generated UUIDs:');
    console.log('UUID 1:', uuid1);
    console.log('UUID 2:', uuid2);
    console.log('UUID 1 is valid:', LibUtils.isValidUUID(uuid1));
  }

  // Value checking and validation
  checkValues(): void {
    const testValues = [
      null,
      undefined,
      '',
      ' ',
      0,
      false,
      [],
      {},
      'hello',
      42,
      [1, 2, 3],
      { name: 'test' },
      new Map(),
      new Map([['key', 'value']]),
      new Set(),
      new Set([1, 2, 3]),
    ];

    console.log('\nValue Analysis:');
    testValues.forEach(value => {
      console.log(`Value: ${JSON.stringify(value)}`);
      console.log(`  isEmpty: ${LibUtils.isEmpty(value)}`);
      console.log(`  hasValue: ${LibUtils.hasValue(value)}`);
      console.log(`  isTruthy: ${LibUtils.isTruthy(value)}`);
      console.log(`  isFalsy: ${LibUtils.isFalsy(value)}`);
      console.log('---');
    });
  }

  // ID validation examples
  validateIdentifiers(): void {
    const testIds = [
      'valid-uuid-v4-here',
      'user123',
      'user_123',
      'user-name',
      '123',
      'invalid id with spaces',
      'invalid@id',
      '',
      'a'.repeat(100),
    ];

    console.log('\nID Validation:');
    testIds.forEach(id => {
      console.log(`ID: "${id}"`);
      console.log(`  Text ID valid: ${LibUtils.isValidTextId(id)}`);

      // Test UUID validation if it looks like a UUID
      if (id.length === 36 && id.includes('-')) {
        console.log(`  UUID valid: ${LibUtils.isValidUUID(id)}`);
      }
    });
  }

  // Number validation
  validateNumbers(): void {
    const testNumbers = [
      42,
      0,
      -5,
      3.14,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Infinity,
      -Infinity,
      NaN,
    ];

    console.log('\nNumber Validation:');
    testNumbers.forEach(num => {
      console.log(`Number: ${num}`);
      console.log(`  Valid integer: ${LibUtils.isValidInteger(num)}`);
    });

    // BigInt validation
    const testBigInts = ['123', '0', 'abc', '123.45', ''];
    console.log('\nBigInt Validation:');
    testBigInts.forEach(str => {
      console.log(`String: "${str}"`);
      console.log(`  Valid BigInt: ${LibUtils.isValidBigInt(str)}`);
    });
  }

  // ID normalization
  normalizeIdentifiers(): void {
    const mixedIds = ['string-id', 42, BigInt(12345), 0];

    console.log('\nID Normalization:');
    mixedIds.forEach(id => {
      const normalized = LibUtils.normalizeIdToString(id);
      console.log(
        `Original: ${id} (${typeof id}) -> Normalized: "${normalized}"`
      );
    });
  }

  // Object comparison
  compareObjects(): void {
    const obj1 = { name: 'John', age: 30, tags: ['user', 'active'] };
    const obj2 = { name: 'John', age: 30, tags: ['user', 'active'] };
    const obj3 = { name: 'Jane', age: 25, tags: ['user'] };
    const obj4 = { age: 30, name: 'John', tags: ['user', 'active'] }; // Different order

    console.log('\nObject Comparison:');
    console.log('obj1 === obj2:', obj1 === obj2); // false (different references)
    console.log('deepEqual(obj1, obj2):', LibUtils.deepEqual(obj1, obj2)); // true
    console.log('deepEqual(obj1, obj3):', LibUtils.deepEqual(obj1, obj3)); // false
    console.log('deepEqual(obj1, obj4):', LibUtils.deepEqual(obj1, obj4)); // true

    // Circular reference handling
    const circular1: any = { name: 'test' };
    circular1.self = circular1;

    const circular2: any = { name: 'test' };
    circular2.self = circular2;

    console.log(
      'deepEqual with circular refs:',
      LibUtils.deepEqual(circular1, circular2)
    );
  }

  // Async operations
  async demonstrateAsyncUtils(): Promise<void> {
    console.log('\nAsync Utilities:');

    const startTime = Date.now();
    console.log('Starting sleep for 1 second...');

    await LibUtils.sleep(1000);

    const endTime = Date.now();
    console.log(`Sleep completed after ${endTime - startTime}ms`);
  }

  // Utility configuration examples
  configureUtilities(options: UtilityOptions): void {
    console.log('\nUtility Configuration:');
    console.log('Options:', options);

    if (options.generateUUID) {
      const uuid = LibUtils.getUUID();
      console.log('Generated UUID:', uuid);
    }

    if (options.validateInput) {
      const testValue = 'test-input';
      console.log('Input validation for "test-input":');
      console.log(`  Valid text ID: ${LibUtils.isValidTextId(testValue)}`);
      console.log(`  Has value: ${LibUtils.hasValue(testValue)}`);
    }
  }

  // User data processing example
  processUserData(userData: UserData): UserData {
    // Normalize and validate user data
    const normalizedId = LibUtils.normalizeIdToString(userData.id);

    if (!LibUtils.hasValue(userData.email) || LibUtils.isEmpty(userData.name)) {
      throw new Error('Invalid user data: email and name are required');
    }

    return {
      ...userData,
      id: normalizedId,
      email: userData.email.trim().toLowerCase(),
      name: userData.name.trim(),
    };
  }
}
```

## Key Features

- **UUID Generation**: Generate and validate UUID v4 identifiers
- **Value Checking**: Comprehensive empty/truthy/falsy checks including edge
  cases
- **ID Validation**: Validate UUIDs, integers, BigInts, and text IDs
- **Object Comparison**: Deep equality checking with circular reference handling
- **Type Safety**: Full TypeScript support with proper type guards
- **Async Utilities**: Sleep function for delays and testing

## Usage Examples

```typescript
const service = new UtilityService();

// Generate unique identifiers
const userId = LibUtils.getUUID();
console.log('User ID:', userId);
console.log('Is valid UUID:', LibUtils.isValidUUID(userId));

// Check values
const emptyValues = [null, undefined, '', [], {}];
const hasValues = emptyValues.filter(val => LibUtils.hasValue(val));
console.log('Values that have value:', hasValues); // []

const nonEmptyValues = ['hello', 42, [1], { a: 1 }];
const truthyValues = nonEmptyValues.filter(val => LibUtils.isTruthy(val));
console.log('Truthy values:', truthyValues); // All of them

// Validate IDs
console.log('Valid text ID:', LibUtils.isValidTextId('user-123')); // true
console.log('Valid integer:', LibUtils.isValidInteger(42)); // true
console.log('Valid BigInt string:', LibUtils.isValidBigInt('12345')); // true

// Compare objects
const user1 = { name: 'John', age: 30 };
const user2 = { name: 'John', age: 30 };
console.log('Objects equal:', LibUtils.deepEqual(user1, user2)); // true

// Async operations
await LibUtils.sleep(1000); // Wait 1 second
console.log('Done waiting');
```

## Common Pitfalls

- **UUID validation**: Not all string IDs are UUIDs - validate accordingly
- **Edge cases**: Special values like `Infinity`, `NaN`, empty objects need
  careful handling
- **Performance**: Deep equality is expensive for large objects - use sparingly
- **BigInt strings**: Only numeric strings are valid BigInt inputs
- **Circular references**: While handled, they can still cause performance
  issues

## Related Examples

- [Result Pattern Fundamentals](./example-1.md)
- [Safe Execution with safeRun](./example-2.md)
- [Advanced Result Patterns](../intermediate/example-1.md)
