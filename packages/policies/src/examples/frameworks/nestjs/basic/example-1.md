# Basic Policy Usage in NestJS

**Version**: 2.0.0  
**Package**: @vytches/ddd-policies  
**Complexity**: basic  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: policy-builder, fluent-api, validation  
**Dependencies**: @nestjs/common, @vytches/ddd-policies

## Description

Basic integration of @vytches/ddd-policies with NestJS applications using manual
setup for straightforward policy validation and business rule enforcement within
controller and service methods.

## Business Context

NestJS applications require integration of business policies for user
validation, request processing, and business rule enforcement. This example
demonstrates the simplest approach to integrate policy validation using manual
instantiation.

## Code Example

```typescript
// user-validation.service.ts
import { Injectable } from '@nestjs/common';
import { PolicyBuilder, PolicyResult } from '@vytches/ddd-policies';
import { User, CreateUserRequest } from './types'; // From your application

/**
 * Basic NestJS service integrating @vytches/ddd-policies
 * Shows manual policy setup and validation
 */
@Injectable()
export class UserValidationService {
  private readonly userRegistrationPolicy;

  constructor() {
    // ⭐ FOCUS: Manual policy setup (beginner-friendly)
    this.userRegistrationPolicy = PolicyBuilder.create<User>()
      .withId('user-registration')
      .withName('User Registration Policy')
      .withDomain('authentication')
      .must(user => user.age >= 18)
      .withCode('AGE_TOO_LOW')
      .withMessage('User must be at least 18 years old')
      .and()
      .must(user => user.email.includes('@'))
      .withCode('INVALID_EMAIL')
      .withMessage('Valid email address required')
      .build();
  }

  /**
   * ✅ FOCUS: Thin wrapper around library policy validation
   */
  async validateUserRegistration(
    userData: CreateUserRequest
  ): Promise<PolicyResult<User>> {
    try {
      const user: User = {
        id: userData.id,
        email: userData.email,
        age: userData.age,
        name: userData.name,
      };

      // Direct library usage for policy validation
      return await this.userRegistrationPolicy.check({
        entity: user,
        context: { operation: 'registration', timestamp: new Date() },
      });
    } catch (error) {
      throw new Error(`User validation failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: Simple policy result handling
   */
  async isUserEligible(user: User): Promise<boolean> {
    const result = await this.userRegistrationPolicy.check({
      entity: user,
      context: { operation: 'eligibility-check' },
    });

    return result.isSuccess();
  }
}
```

## Key Features

- **🔧 Manual Setup**: Simple policy instantiation in constructor
- **📝 Basic Validation**: Essential business rule validation
- **🏗️ NestJS Integration**: Standard Injectable service pattern
- **✅ Result Handling**: Direct policy result usage

## Integration Benefits

### **Simplicity**

- **Easy Setup**: Manual instantiation with clear policy configuration
- **Direct Usage**: Straightforward policy validation in service methods
- **Standard Patterns**: Follows NestJS service conventions

### **Flexibility**

- **Custom Configuration**: Full control over policy setup and validation
- **Error Handling**: Standard try/catch patterns with meaningful errors
- **Type Safety**: Full TypeScript support with interface definitions

## Common Pitfalls

- **❌ Missing Error Handling**: Always wrap policy checks in try/catch blocks
- **❌ Static Policies**: Consider policy reusability across different contexts
- **❌ No Caching**: For high-frequency validations, consider caching policy
  results

## Related Examples

- [Example 2: Policy Specification Integration](./example-2.md) - Advanced
  validation patterns
- [Basic: Policy Builder](../../basic/example-1.md) - Core library usage
  patterns
- [Intermediate: NestJS DI Integration](../intermediate/example-1.md) - Advanced
  dependency injection
