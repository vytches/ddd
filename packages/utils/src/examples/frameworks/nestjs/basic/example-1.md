# Result Pattern with NestJS - Basic Integration

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: Basic
**Framework**: NestJS **Base Example**:
[Result Pattern Fundamentals](../../basic/example-1.md) **Dependencies**:
@nestjs/common, @vytches/ddd-utils

## Business Context

This example demonstrates basic integration of the Result pattern from
@vytches/ddd-utils with NestJS services. It shows manual setup and configuration
without complex dependency injection patterns, making it ideal for teams
starting with functional error handling in NestJS applications. Perfect for user
validation services, API response handling, and basic business operations.

## Service Implementation

```typescript
// user-validation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Result } from '@vytches/ddd-utils';
import type {
  UserData,
  ValidationError,
  UserRegistrationRequest,
  UserProfile,
} from '../types'; // From your application

@Injectable()
export class UserValidationService {
  constructor() {
    // ⭐ FOCUS: Manual setup - no complex DI configuration needed
  }

  // ✅ FOCUS: Result pattern for validation operations
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

  // ✅ FOCUS: NestJS controller integration with Result pattern
  async processRegistration(
    request: UserRegistrationRequest
  ): Promise<Result<UserProfile, ValidationError>> {
    try {
      // Validate input using Result pattern
      const validationResult = this.validateUser(request.userData);

      if (validationResult.isFailure) {
        return Result.fail(validationResult.error);
      }

      const validUser = validationResult.value;

      // Simulate async operation
      const userProfile: UserProfile = {
        id: `user-${Date.now()}`,
        email: validUser.email,
        name: validUser.name,
        role: validUser.role || 'user',
        createdAt: new Date(),
        isActive: true,
      };

      return Result.ok(userProfile);
    } catch (error) {
      // Handle unexpected errors
      return Result.fail({
        field: 'system',
        message: `Registration failed: ${(error as Error).message}`,
        value: null,
      });
    }
  }

  // ✅ FOCUS: Safe JSON parsing with Result pattern
  parseUserData(jsonString: string): Result<UserData, Error> {
    return Result.try(() => {
      const parsed = JSON.parse(jsonString);
      return parsed as UserData;
    });
  }

  // ✅ FOCUS: Transform Result to NestJS response format
  formatValidationResponse(userData: UserData): {
    success: boolean;
    data?: UserData;
    error?: string;
  } {
    const result = this.validateUser(userData);

    return result.match(
      user => ({ success: true, data: user }),
      error => ({ success: false, error: error.message })
    );
  }

  // ✅ FOCUS: Chained validation operations
  validateAndTransformUser(
    userData: UserData
  ): Result<string, ValidationError> {
    return this.validateUser(userData)
      .map(user => user.name.trim())
      .map(name => name.toUpperCase())
      .map(name => `Validated User: ${name}`);
  }
}
```

## Controller Usage

```typescript
// user.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UserValidationService } from './user-validation.service';
import type { UserRegistrationRequest, ApiResponse } from '../types'; // From your application

@Controller('users')
export class UserController {
  constructor(private readonly userValidationService: UserValidationService) {}

  @Post('register')
  async registerUser(
    @Body() request: UserRegistrationRequest
  ): Promise<ApiResponse> {
    // ⭐ FOCUS: Using Result pattern in NestJS controller
    const result =
      await this.userValidationService.processRegistration(request);

    if (result.isFailure) {
      // Convert Result failure to NestJS HTTP exception
      throw new BadRequestException({
        message: 'User registration failed',
        details: result.error,
      });
    }

    // Return successful result
    return {
      success: true,
      data: result.value,
      message: 'User registered successfully',
    };
  }

  @Post('validate')
  async validateUser(@Body() userData: any): Promise<ApiResponse> {
    // Parse and validate using Result pattern
    const parseResult = Result.try<UserData>(() => userData as UserData);

    if (parseResult.isFailure) {
      throw new BadRequestException({
        message: 'Invalid user data format',
        details: parseResult.error.message,
      });
    }

    const validationResponse =
      this.userValidationService.formatValidationResponse(parseResult.value);

    if (!validationResponse.success) {
      throw new BadRequestException({
        message: 'User validation failed',
        details: validationResponse.error,
      });
    }

    return {
      success: true,
      data: validationResponse.data,
      message: 'User data is valid',
    };
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserValidationService } from './user-validation.service';

@Module({
  controllers: [UserController],
  providers: [UserValidationService],
  exports: [UserValidationService],
})
export class UserModule {}
```

## Key Features

- **Type-Safe Error Handling**: Result pattern ensures all errors are handled
  explicitly
- **NestJS Integration**: Seamless integration with NestJS controllers and
  services
- **HTTP Exception Mapping**: Convert Result failures to appropriate HTTP
  responses
- **Manual Setup**: Simple configuration without complex dependency injection
- **Functional Composition**: Chain operations safely with map and flatMap
- **Exception Wrapping**: Convert throwing operations to Result pattern with
  Result.try

## Common Pitfalls

- **Not checking isFailure**: Always verify Result state before accessing value
- **Inconsistent error handling**: Use either Result pattern or exceptions, not
  both
- **Missing HTTP status mapping**: Map validation errors to appropriate HTTP
  status codes
- **Accessing value on failure**: Will throw error - always use type guards
- **Forgetting async operations**: Use proper Promise<Result<T, E>> for async
  operations

## Related Examples

- [Result Pattern Fundamentals](../../basic/example-1.md) - Core Result pattern
  concepts
- [Advanced Result Patterns](../../intermediate/example-1.md) - Complex Result
  operations
- [Async Result Patterns](../../intermediate/example-2.md) - Async Result
  handling
- [Intermediate NestJS Integration](../intermediate/example-1.md) - Advanced
  VytchesDDD DI integration
