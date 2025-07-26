# NestJS Basic Validation Integration - Manual Setup

**Package**: @vytches/ddd-validation  
**Framework**: NestJS  
**Complexity**: Basic  
**Focus**: Manual integration with standard NestJS patterns

## Overview

This example demonstrates basic integration of @vytches/ddd-validation with
NestJS using manual setup and standard dependency injection patterns. Perfect
for beginners wanting to understand the fundamentals of validation integration.

## Implementation

```typescript
// user-validation.service.ts
import { Injectable } from '@nestjs/common';
import {
  BaseSpecification,
  IValidator,
  ValidationResult,
  FieldValidator,
} from '@vytches/ddd-validation';
import { User, ValidationContext } from './types'; // From your application

// Email validation specification
class EmailSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): SpecificationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(user.email);

    return {
      isSatisfied: isValid,
      reason: isValid ? undefined : 'Invalid email format',
      metadata: { field: 'email', rule: 'email-format' },
    };
  }
}

// Age validation specification
class AgeSpecification extends BaseSpecification<User> {
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
      metadata: { field: 'age', minimumRequired: this.minimumAge },
    };
  }
}

@Injectable()
export class UserValidationService implements IValidator<User> {
  private emailSpec: EmailSpecification;
  private ageSpec: AgeSpecification;
  private fieldValidator: FieldValidator;

  constructor() {
    // ⭐ FOCUS: Manual library setup (beginner-friendly)
    this.emailSpec = new EmailSpecification();
    this.ageSpec = new AgeSpecification(18);
    this.initializeFieldValidator();
  }

  async validate(
    user: User,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate email using specification
    const emailResult = this.emailSpec.isSatisfiedBy(user);
    if (!emailResult.isSatisfied) {
      errors.push({
        field: 'email',
        code: 'INVALID_EMAIL',
        message: emailResult.reason!,
        severity: 'error',
      });
    }

    // Validate age using specification
    const ageResult = this.ageSpec.isSatisfiedBy(user);
    if (!ageResult.isSatisfied) {
      errors.push({
        field: 'age',
        code: 'AGE_TOO_LOW',
        message: ageResult.reason!,
        severity: 'error',
      });
    }

    // Field-level validation for completeness
    const fieldResults = await Promise.all([
      this.fieldValidator.validateField(user, 'firstName', user.firstName),
      this.fieldValidator.validateField(user, 'lastName', user.lastName),
      this.fieldValidator.validateField(user, 'phoneNumber', user.phoneNumber),
    ]);

    // Aggregate field validation results
    fieldResults.forEach(result => {
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validationDuration: 0,
        rulesApplied: ['email-format', 'minimum-age', 'field-validation'],
        skippedRules: [],
        validatorVersion: '1.0.0',
        context: context || {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'standard',
        },
      },
    };
  }

  private initializeFieldValidator(): void {
    const fieldRules: BusinessRule[] = [
      {
        id: 'first-name-required',
        name: 'First Name Required',
        description: 'First name cannot be empty',
        category: 'user',
        priority: 1,
        isActive: true,
        conditions: [{ field: 'firstName', operator: 'not_equals', value: '' }],
        actions: [{ type: 'validate', parameters: {} }],
      },
      {
        id: 'last-name-required',
        name: 'Last Name Required',
        description: 'Last name cannot be empty',
        category: 'user',
        priority: 1,
        isActive: true,
        conditions: [{ field: 'lastName', operator: 'not_equals', value: '' }],
        actions: [{ type: 'validate', parameters: {} }],
      },
      {
        id: 'phone-format',
        name: 'Phone Number Format',
        description: 'Phone number must be valid format',
        category: 'user',
        priority: 2,
        isActive: true,
        conditions: [
          {
            field: 'phoneNumber',
            operator: 'regex',
            value: '^\\+?[\\d\\s\\-\\(\\)]+$',
          },
        ],
        actions: [{ type: 'validate', parameters: {} }],
      },
    ];

    this.fieldValidator = new FieldValidator(fieldRules);
  }
}

// user.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UserValidationService } from './user-validation.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userValidationService: UserValidationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      // ✅ FOCUS: Thin wrapper around library validation
      const validationResult = await this.userValidationService.validate(
        createUserDto as User,
        {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'standard',
        }
      );

      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
      }

      // User creation logic would go here
      return {
        success: true,
        message: 'User validation passed',
        validationMetadata: validationResult.metadata,
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'User validation failed',
        error: error.message,
      });
    }
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async validateUserBatch(@Body() users: CreateUserDto[]) {
    try {
      const validationPromises = users.map(user =>
        this.userValidationService.validate(user as User)
      );

      const results = await Promise.all(validationPromises);

      const validUsers = results.filter(r => r.isValid).length;
      const invalidUsers = results.filter(r => !r.isValid).length;

      return {
        success: true,
        summary: {
          total: users.length,
          valid: validUsers,
          invalid: invalidUsers,
          successRate: validUsers / users.length,
        },
        results: results.map((result, index) => ({
          index,
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings,
        })),
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Batch validation failed',
        error: error.message,
      });
    }
  }
}

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

// app.module.ts
import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';

@Module({
  imports: [UserModule],
})
export class AppModule {}
```

## Key Points

- **Simple Manual Instantiation**: Direct creation of validation specifications
  and services
- **Standard NestJS Patterns**: Uses familiar Injectable decorators and
  dependency injection
- **Library Integration**: Shows core @vytches/ddd-validation usage in NestJS
  context
- **Error Handling**: Proper HTTP error responses with validation details
- **Batch Support**: Demonstrates handling multiple validation requests

## Usage Example

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "age": 25,
    "phoneNumber": "+1-555-0123"
  }'

# Validate multiple users
curl -X POST http://localhost:3000/users/batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "email": "user1@example.com",
      "firstName": "User",
      "lastName": "One",
      "age": 30,
      "phoneNumber": "+1-555-0001"
    },
    {
      "email": "invalid-email",
      "firstName": "",
      "lastName": "Two",
      "age": 15,
      "phoneNumber": "invalid"
    }
  ]'
```

## Next Steps

- Review [Advanced Field Validation](./example-2.md)
- Explore [VytchesDDD DI Integration](../intermediate/example-1.md)
- Study [Enterprise Validation Patterns](../advanced/example-1.md)
