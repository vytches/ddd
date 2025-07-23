# Advanced Result Patterns

**Version**: 1.0.0
**Package**: @vytches-ddd/utils
**Complexity**: intermediate
**Domain**: Infrastructure
**Patterns**: Result chaining, functional composition, monadic operations
**Dependencies**: @vytches-ddd/utils

## Description

Advanced Result pattern techniques including chaining operations, functional composition, and monadic transformations. This example demonstrates how to build complex data processing pipelines using Result patterns while maintaining type safety and proper error handling.

## Business Context

Complex business operations often involve multiple steps where any step can fail:
- Data validation pipelines with multiple validation rules
- Multi-step data transformations
- Operations that depend on previous successful operations
- Complex business workflows with branching logic

Advanced Result patterns enable you to compose these operations cleanly while maintaining explicit error handling.

## Code Example

```typescript
// advanced-result-patterns.ts
import { Result } from '@vytches-ddd/utils';
import { 
  UserData, 
  ValidationError, 
  ChainableOperation, 
  Pipeline,
  AsyncResult,
  Railway 
} from '../types';

// ✅ FOCUS: Advanced Result pattern composition
export class AdvancedResultPatterns {
  
  // 1. Result Chaining with Complex Validation
  validateUserProfile(userData: Partial<UserData>): Result<UserData, ValidationError> {
    return this.validateEmail(userData.email)
      .flatMap(() => this.validateName(userData.name))
      .flatMap(() => this.validateRole(userData.role))
      .map(() => this.createValidatedUser(userData));
  }

  private validateEmail(email?: string): Result<string, ValidationError> {
    if (!email) {
      return Result.fail({
        field: 'email',
        message: 'Email is required',
        value: email,
      });
    }

    if (!email.includes('@')) {
      return Result.fail({
        field: 'email',
        message: 'Invalid email format',
        value: email,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Result.fail({
        field: 'email',
        message: 'Email format is invalid',
        value: email,
      });
    }

    return Result.ok(email.toLowerCase().trim());
  }

  private validateName(name?: string): Result<string, ValidationError> {
    if (!name || name.trim().length === 0) {
      return Result.fail({
        field: 'name',
        message: 'Name is required',
        value: name,
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return Result.fail({
        field: 'name',
        message: 'Name must be at least 2 characters',
        value: name,
      });
    }

    if (trimmedName.length > 100) {
      return Result.fail({
        field: 'name',
        message: 'Name cannot exceed 100 characters',
        value: name,
      });
    }

    return Result.ok(trimmedName);
  }

  private validateRole(role?: string): Result<string, ValidationError> {
    const validRoles = ['admin', 'user', 'moderator', 'guest'];
    const normalizedRole = role?.toLowerCase() || 'user';
    
    if (!validRoles.includes(normalizedRole)) {
      return Result.fail({
        field: 'role',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        value: role,
      });
    }

    return Result.ok(normalizedRole);
  }

  private createValidatedUser(userData: Partial<UserData>): UserData {
    return {
      id: userData.id || `user-${Date.now()}`,
      email: userData.email!,
      name: userData.name!,
      role: userData.role || 'user',
      createdAt: userData.createdAt || new Date(),
    };
  }

  // 2. Complex Data Processing Pipeline
  processUserDataPipeline(rawData: any): Result<UserData, Error> {
    return Result.try(() => this.parseRawData(rawData))
      .flatMap(parsed => this.normalizeData(parsed))
      .flatMap(normalized => this.validateUserProfile(normalized))
      .flatMap(validated => this.enrichUserData(validated))
      .tap(user => console.log(`Successfully processed user: ${user.name}`))
      .tapError(error => console.error(`Pipeline failed: ${error.message}`));
  }

  private parseRawData(rawData: any): any {
    if (typeof rawData === 'string') {
      return JSON.parse(rawData);
    }
    if (typeof rawData === 'object' && rawData !== null) {
      return rawData;
    }
    throw new Error('Invalid raw data format');
  }

  private normalizeData(data: any): Result<Partial<UserData>, Error> {
    return Result.try(() => ({
      email: data.email || data.Email || data.EMAIL,
      name: data.name || data.fullName || data.displayName,
      role: data.role || data.userRole || data.permission_level,
      id: data.id || data.userId || data.user_id,
    }));
  }

  private enrichUserData(userData: UserData): Result<UserData, Error> {
    return Result.ok({
      ...userData,
      createdAt: new Date(),
      id: userData.id || `enriched-${Date.now()}`,
    });
  }

  // 3. Conditional Result Processing
  processUserWithBusinessRules(userData: UserData): Result<UserData, ValidationError> {
    return Result.ok(userData)
      .flatMap(user => {
        // Business rule: Admins must have special email domains
        if (user.role === 'admin' && !user.email.endsWith('@company.com')) {
          return Result.fail<UserData, ValidationError>({
            field: 'email',
            message: 'Admin users must have @company.com email address',
            value: user.email,
          });
        }
        return Result.ok(user);
      })
      .flatMap(user => {
        // Business rule: New users need approval
        const isNewUser = !user.id.startsWith('existing-');
        if (isNewUser && user.role !== 'guest') {
          return Result.ok({
            ...user,
            role: 'guest', // Downgrade new users to guest initially
          });
        }
        return Result.ok(user);
      })
      .map(user => {
        // Apply final transformations
        return {
          ...user,
          email: user.email.toLowerCase(),
          name: this.capitalizeWords(user.name),
        };
      });
  }

  private capitalizeWords(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // 4. Result Aggregation Patterns
  processMultipleUsers(userDataList: Partial<UserData>[]): Result<UserData[], ValidationError[]> {
    const results = userDataList.map((userData, index) => 
      this.validateUserProfile(userData)
        .mapError(error => ({
          ...error,
          field: `users[${index}].${error.field}`,
        }))
    );

    const successfulUsers: UserData[] = [];
    const errors: ValidationError[] = [];

    results.forEach(result => {
      if (result.isSuccess) {
        successfulUsers.push(result.value);
      } else {
        errors.push(result.error);
      }
    });

    if (errors.length > 0) {
      return Result.fail(errors);
    }

    return Result.ok(successfulUsers);
  }

  // 5. Result Transformation Chains
  createUserDisplayInfo(userData: UserData): Result<string, Error> {
    return Result.ok(userData)
      .map(user => ({ // Transform to display data
        displayName: `${user.name} (${user.role})`,
        emailDomain: user.email.split('@')[1],
        memberSince: user.createdAt.getFullYear(),
      }))
      .map(display => // Create formatted string
        `${display.displayName} - ${display.emailDomain} - Member since ${display.memberSince}`
      )
      .flatMap(displayString => {
        // Validate final output
        if (displayString.length > 200) {
          return Result.fail(new Error('Display string too long'));
        }
        return Result.ok(displayString);
      });
  }

  // 6. Advanced Error Recovery
  processUserWithFallback(primaryData: Partial<UserData>, fallbackData: Partial<UserData>): Result<UserData, Error> {
    return this.validateUserProfile(primaryData)
      .flatMap(user => Result.ok(user)) // Primary success path
      .match(
        // On success, return the primary result
        user => Result.ok(user),
        // On failure, try fallback
        _error => this.validateUserProfile(fallbackData)
          .map(fallbackUser => ({
            ...fallbackUser,
            id: `fallback-${fallbackUser.id}`,
          }))
          .mapError(fallbackError => 
            new Error(`Both primary and fallback validation failed: ${fallbackError.message}`)
          )
      );
  }

  // 7. Compose Complex Operations
  createUserAccount(
    userData: Partial<UserData>, 
    preferences: any, 
    permissions: string[]
  ): Result<any, Error> {
    // Chain multiple complex operations
    return this.validateUserProfile(userData)
      .flatMap(user => this.processUserWithBusinessRules(user))
      .flatMap(processedUser => 
        this.validatePreferences(preferences)
          .map(validPrefs => ({ user: processedUser, preferences: validPrefs }))
      )
      .flatMap(({ user, preferences }) =>
        this.validatePermissions(permissions)
          .map(validPerms => ({ user, preferences, permissions: validPerms }))
      )
      .map(account => ({
        ...account,
        accountId: `acc-${account.user.id}`,
        createdAt: new Date(),
        status: 'active',
      }));
  }

  private validatePreferences(preferences: any): Result<any, Error> {
    return Result.try(() => {
      if (!preferences || typeof preferences !== 'object') {
        throw new Error('Preferences must be an object');
      }
      return {
        theme: preferences.theme || 'light',
        notifications: preferences.notifications !== false,
        language: preferences.language || 'en',
      };
    });
  }

  private validatePermissions(permissions: string[]): Result<string[], Error> {
    const validPermissions = ['read', 'write', 'delete', 'admin'];
    
    if (!Array.isArray(permissions)) {
      return Result.fail(new Error('Permissions must be an array'));
    }

    const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPerms.length > 0) {
      return Result.fail(new Error(`Invalid permissions: ${invalidPerms.join(', ')}`));
    }

    return Result.ok(permissions);
  }
}

// Extension to Result class for additional operations
declare module '@vytches-ddd/utils' {
  interface Result<TValue, TError> {
    mapError<TNewError>(fn: (error: TError) => TNewError): Result<TValue, TNewError>;
  }
}

// Implementation of mapError extension (would be in actual utils package)
Result.prototype.mapError = function<TValue, TError, TNewError>(
  this: Result<TValue, TError>,
  fn: (error: TError) => TNewError
): Result<TValue, TNewError> {
  if (this.isSuccess) {
    return Result.ok(this.value);
  }
  return Result.fail(fn(this.error));
};
```

## Key Features

- **Complex Validation Chains**: Multiple validation steps with early termination
- **Data Processing Pipelines**: Multi-step transformations with error handling
- **Conditional Logic**: Business rule application within Result chains
- **Error Recovery**: Fallback mechanisms for failed operations
- **Result Aggregation**: Processing multiple items with error collection
- **Advanced Transformations**: Complex data shaping with type safety

## Usage Examples

```typescript
const processor = new AdvancedResultPatterns();

// Complex validation pipeline
const userData = { email: 'john@example.com', name: 'John Doe' };
const result = processor.validateUserProfile(userData);

if (result.isSuccess) {
  console.log('Valid user:', result.value);
} else {
  console.error('Validation failed:', result.error);
}

// Data processing pipeline
const rawData = '{"email": "jane@example.com", "fullName": "Jane Smith"}';
const processedResult = processor.processUserDataPipeline(rawData);

processedResult
  .tap(user => console.log('Processing successful'))
  .tapError(error => console.error('Processing failed'));

// Multiple users with error aggregation
const userList = [
  { email: 'valid@example.com', name: 'Valid User' },
  { email: 'invalid-email', name: 'Invalid User' },
  { email: 'another@example.com', name: 'A' }, // Too short name
];

const aggregateResult = processor.processMultipleUsers(userList);
```

## Common Pitfalls

- **Deep nesting**: Avoid excessive flatMap chaining - break into smaller functions
- **Error context loss**: Use mapError to maintain error context through transformations
- **Performance**: Consider lazy evaluation for complex chains
- **Type complexity**: TypeScript inference can struggle with deeply nested Results

## Related Examples

- [Result Pattern Fundamentals](../basic/example-1.md)
- [Async Result Patterns](./example-2.md)
- [Monadic Operations](../advanced/example-1.md)