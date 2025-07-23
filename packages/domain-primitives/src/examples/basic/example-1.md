# Simple Domain Errors

**Version**: 2025-01-21  
**Package**: @vytches-ddd/domain-primitives  
**Complexity**: Basic  
**Category**: Error Handling

## Overview

Domain errors are fundamental building blocks in Domain-Driven Design. They
provide rich context about what went wrong in your domain operations, making
debugging easier and improving system reliability.

## Basic Domain Error Implementation

```typescript
import {
  BaseError,
  IDomainError,
  DomainErrorCode,
  NotFoundError,
  InvalidParameterError,
  DuplicateError,
} from '@vytches-ddd/domain-primitives';
import { UserData, CreateUserDto } from '../types';

// Custom domain error for user operations
export class UserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`, {
      code: DomainErrorCode.NotFound,
      domain: 'UserManagement',
      data: { userId },
    });
  }
}

// Email already exists error
export class EmailAlreadyExistsError extends DuplicateError {
  constructor(email: string) {
    super(`Email ${email} is already registered`, {
      code: DomainErrorCode.Duplicate,
      domain: 'UserManagement',
      data: { email },
    });
  }
}

// Invalid user data error
export class InvalidUserDataError extends InvalidParameterError {
  constructor(field: string, reason: string) {
    super(`Invalid user data: ${field} - ${reason}`, {
      code: DomainErrorCode.InvalidParameter,
      domain: 'UserManagement',
      data: { field, reason },
    });
  }
}

// ✅ Using domain errors in a service
export class UserService {
  private users: Map<string, UserData> = new Map();
  private emailIndex: Set<string> = new Set();

  async createUser(dto: CreateUserDto): Promise<UserData> {
    // Validation with domain errors
    if (!dto.email || !this.isValidEmail(dto.email)) {
      throw new InvalidUserDataError('email', 'Invalid email format');
    }

    if (!dto.name || dto.name.length < 2) {
      throw new InvalidUserDataError(
        'name',
        'Name must be at least 2 characters'
      );
    }

    if (!dto.password || dto.password.length < 8) {
      throw new InvalidUserDataError(
        'password',
        'Password must be at least 8 characters'
      );
    }

    // Check for duplicate email
    if (this.emailIndex.has(dto.email.toLowerCase())) {
      throw new EmailAlreadyExistsError(dto.email);
    }

    // Create user
    const user: UserData = {
      id: this.generateId(),
      email: dto.email.toLowerCase(),
      name: dto.name,
      role: 'user',
    };

    this.users.set(user.id, user);
    this.emailIndex.add(user.email);

    return user;
  }

  async findUserById(userId: string): Promise<UserData> {
    const user = this.users.get(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return user;
  }

  async updateUserEmail(userId: string, newEmail: string): Promise<UserData> {
    const user = await this.findUserById(userId);

    if (!this.isValidEmail(newEmail)) {
      throw new InvalidUserDataError('email', 'Invalid email format');
    }

    if (
      this.emailIndex.has(newEmail.toLowerCase()) &&
      user.email !== newEmail.toLowerCase()
    ) {
      throw new EmailAlreadyExistsError(newEmail);
    }

    // Update email
    this.emailIndex.delete(user.email);
    user.email = newEmail.toLowerCase();
    this.emailIndex.add(user.email);

    return user;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Error Handling in Controllers

```typescript
import { ErrorResponse, SuccessResponse } from '../types';

export class UserController {
  constructor(private userService: UserService) {}

  async handleCreateUser(
    dto: CreateUserDto
  ): Promise<SuccessResponse<UserData> | ErrorResponse> {
    try {
      const user = await this.userService.createUser(dto);

      return {
        success: true,
        data: user,
        metadata: {
          timestamp: new Date(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      if (error instanceof IDomainError) {
        return this.handleDomainError(error);
      }

      // Handle unexpected errors
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date(),
        },
      };
    }
  }

  private handleDomainError(error: IDomainError): ErrorResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.data,
        timestamp: new Date(),
      },
    };
  }
}
```

## Error Context and Logging

```typescript
import {
  DomainErrorCode,
  type DomainErrorOptions,
} from '@vytches-ddd/domain-primitives';
import { ErrorContext } from '../types';

// Enhanced error with context
export class ContextualDomainError extends IDomainError {
  context: ErrorContext;

  constructor(
    message: string,
    options: DomainErrorOptions,
    context: ErrorContext
  ) {
    super(message, options);
    this.context = context;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      domain: this.domain,
      data: this.data,
      context: this.context,
      stack: this.stack,
    };
  }
}

// Usage with context
export class AuthenticationError extends ContextualDomainError {
  constructor(reason: string, context: ErrorContext) {
    super(
      `Authentication failed: ${reason}`,
      {
        code: DomainErrorCode.Unauthorized,
        domain: 'Authentication',
        data: { reason },
      },
      context
    );
  }
}

// Example usage
export class AuthService {
  async authenticate(token: string, context: ErrorContext): Promise<UserData> {
    if (!token || !this.isValidToken(token)) {
      throw new AuthenticationError('Invalid token', context);
    }

    // Authentication logic...
    const user = this.decodeToken(token);
    if (!user) {
      throw new AuthenticationError('Token expired or invalid', context);
    }

    return user;
  }

  private isValidToken(token: string): boolean {
    // Token validation logic
    return token.startsWith('Bearer ') && token.length > 10;
  }

  private decodeToken(token: string): UserData | null {
    // Simplified token decoding
    return {
      id: 'user_123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
    };
  }
}
```

## Key Benefits

1. **Rich Context**: Domain errors carry meaningful information about what went
   wrong
2. **Type Safety**: TypeScript ensures proper error handling
3. **Consistency**: Standardized error structure across the application
4. **Debugging**: Easy to trace and debug with detailed error information
5. **Domain Focus**: Errors speak the language of your domain

## Best Practices

1. **Create specific error types** for different domain scenarios
2. **Include relevant data** in error objects for debugging
3. **Use error codes** for programmatic error handling
4. **Maintain error hierarchies** for better organization
5. **Document error scenarios** in your domain models

## Common Patterns

```typescript
// ✅ Good: Specific domain errors
throw new UserNotFoundError(userId);
throw new InsufficientFundsError(accountId, requiredAmount);
throw new OrderAlreadyShippedError(orderId);

// ❌ Bad: Generic errors
throw new Error('User not found');
throw new Error('Not enough money');
throw new Error('Cannot modify order');

// ✅ Good: Rich error context
throw new PaymentFailedError(paymentId, {
  amount,
  currency,
  gateway: 'stripe',
  errorCode: 'insufficient_funds',
});

// ❌ Bad: Missing context
throw new Error('Payment failed');
```

## Next Steps

- Explore intermediate error hierarchies
- Learn about error aggregation patterns
- Implement error recovery strategies
- Add error tracking and monitoring
