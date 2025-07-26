# Advanced NestJS DI Integration with @vytches/ddd-di

**Version**: 2.0.0  
**Package**: @vytches/ddd-policies  
**Complexity**: intermediate  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: di-integration, service-locator, enterprise-architecture  
**Dependencies**: @nestjs/common, @vytches/ddd-policies, @vytches/ddd-di

## Description

Advanced integration of @vytches/ddd-policies with NestJS using the
@vytches/ddd-di service locator pattern for enterprise-grade dependency
injection, policy behaviors, and cross-cutting concerns.

## Business Context

Enterprise applications require sophisticated policy management with
cross-cutting concerns like retry logic, caching, and audit logging. This
example demonstrates integration with @vytches/ddd-di for advanced policy
orchestration and behavior composition.

## Code Example

```typescript
// user-policy.service.ts - Domain Service with DI Integration
import { Injectable } from '@nestjs/common';
import { DomainService, VytchesDDD, ServiceLifetime } from '@vytches/ddd-di';
import {
  PolicyBuilder,
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyResult,
} from '@vytches/ddd-policies';
import { User, CreateUserRequest, PolicyContext } from './types'; // From your application

/**
 * Domain service with advanced DI integration and policy behaviors
 * Demonstrates enterprise-grade policy management patterns
 */
@DomainService({
  serviceId: 'userPolicyService',
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
  dependencies: ['auditService', 'configurationService'],
  autoRegister: true,
})
export class UserPolicyService {
  private readonly baseUserPolicy;
  private readonly cachedUserPolicy;
  private readonly retryUserPolicy;

  constructor() {
    // ⭐ FOCUS: Build base policy with business rules
    this.baseUserPolicy = PolicyBuilder.create<User>()
      .withId('user-validation-advanced')
      .withName('Advanced User Validation Policy')
      .withDomain('user-management')
      .must(user => user.age >= 18)
      .withCode('AGE_INSUFFICIENT')
      .withMessage('User must be at least 18 years old')
      .and()
      .must(user => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))
      .withCode('EMAIL_INVALID')
      .withMessage('Valid email address required')
      .and()
      .mustAsync(async user => await this.validateUniqueEmail(user.email))
      .withCode('EMAIL_DUPLICATE')
      .withMessage('Email address already in use')
      .build();

    // ⭐ FOCUS: Wrap with caching behavior for performance
    this.cachedUserPolicy = PolicyCachingBehavior.create(this.baseUserPolicy, {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      keyGenerator: request => `user-${request.entity.email}`,
      namespace: 'user-validation',
    });

    // ⭐ FOCUS: Wrap with retry behavior for resilience
    this.retryUserPolicy = PolicyRetryBehavior.create(this.cachedUserPolicy, {
      maxAttempts: 3,
      baseDelay: 1000,
      backoff: 'exponential',
      shouldRetry: violation => violation.code.includes('TIMEOUT'),
    });
  }

  /**
   * ✅ FOCUS: Advanced policy validation with behaviors
   */
  async validateUser(
    userData: CreateUserRequest,
    context: PolicyContext
  ): Promise<PolicyResult<User>> {
    try {
      const user: User = {
        id: userData.id || `user-${Date.now()}`,
        email: userData.email,
        age: userData.age,
        name: userData.name,
        isActive: true,
        createdAt: new Date(),
      };

      // Use policy with retry and caching behaviors
      return await this.retryUserPolicy.check({
        entity: user,
        context: {
          ...context,
          operation: 'user-validation',
          timestamp: new Date(),
          correlationId: context.correlationId || `validate-${Date.now()}`,
        },
      });
    } catch (error) {
      throw new Error(`Advanced user validation failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: Policy behavior composition for different scenarios
   */
  async validatePremiumUser(
    userData: CreateUserRequest
  ): Promise<PolicyResult<User>> {
    // Create premium-specific policy with different rules
    const premiumPolicy = PolicyBuilder.create<User>()
      .withId('premium-user-validation')
      .withName('Premium User Validation')
      .withDomain('user-management')
      .must(user => user.age >= 21)
      .withCode('PREMIUM_AGE_INSUFFICIENT')
      .withMessage('Premium users must be at least 21 years old')
      .and()
      .mustAsync(async user => await this.validateCreditScore(user))
      .withCode('CREDIT_SCORE_TOO_LOW')
      .withMessage('Premium membership requires minimum credit score')
      .build();

    // Apply different caching strategy for premium validation
    const premiumCachedPolicy = PolicyCachingBehavior.create(premiumPolicy, {
      ttl: 600000, // 10 minutes for premium
      keyGenerator: request => `premium-${request.entity.email}`,
      namespace: 'premium-validation',
    });

    const user: User = {
      id: userData.id || `premium-${Date.now()}`,
      email: userData.email,
      age: userData.age,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
    };

    return await premiumCachedPolicy.check({
      entity: user,
      context: {
        operation: 'premium-validation',
        tier: 'premium',
      },
    });
  }

  private async validateUniqueEmail(email: string): Promise<boolean> {
    // Simulate async email uniqueness check
    const existingUser = await this.findUserByEmail(email);
    return !existingUser;
  }

  private async validateCreditScore(user: User): Promise<boolean> {
    // Simulate credit score validation through external service
    const creditService = VytchesDDD.resolve<any>('creditService');
    const score = await creditService.getCreditScore(user.email);
    return score >= 650;
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    // Simulate database lookup
    return Math.random() > 0.9
      ? null
      : {
          id: 'existing',
          email,
          age: 25,
          name: 'Existing User',
          isActive: true,
          createdAt: new Date(),
        };
  }
}

// user-management.controller.ts - NestJS Controller with Bridge Pattern
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { CreateUserRequest } from './types'; // From your application

/**
 * NestJS Controller using Bridge Pattern for DI integration
 * Demonstrates proper service locator usage
 */
@Controller('users')
export class UserManagementController {
  private readonly userPolicyService: UserPolicyService;

  constructor() {
    // ⭐ FOCUS: Bridge Pattern - Get existing instance from VytchesDDD
    this.userPolicyService =
      VytchesDDD.resolve<UserPolicyService>('userPolicyService');
  }

  /**
   * ✅ FOCUS: Thin wrapper delegating to VytchesDDD service
   */
  @Post('validate')
  async validateUser(@Body() userData: CreateUserRequest) {
    try {
      const result = await this.userPolicyService.validateUser(userData, {
        correlationId: `req-${Date.now()}`,
        userId: userData.id,
        operation: 'user-registration',
      });

      if (result.isFailure()) {
        throw new BadRequestException({
          message: 'User validation failed',
          errors: result.error.violations.map(v => ({
            code: v.code,
            message: v.message,
            field: this.mapCodeToField(v.code),
          })),
        });
      }

      return {
        success: true,
        message: 'User validation successful',
        user: result.value,
      };
    } catch (error) {
      throw new BadRequestException(`Validation failed: ${error.message}`);
    }
  }

  @Post('validate-premium')
  async validatePremiumUser(@Body() userData: CreateUserRequest) {
    try {
      const result = await this.userPolicyService.validatePremiumUser(userData);

      if (result.isFailure()) {
        throw new BadRequestException({
          message: 'Premium user validation failed',
          errors: result.error.violations,
        });
      }

      return {
        success: true,
        message: 'Premium user validation successful',
        user: result.value,
      };
    } catch (error) {
      throw new BadRequestException(
        `Premium validation failed: ${error.message}`
      );
    }
  }

  private mapCodeToField(code: string): string {
    const fieldMapping = {
      AGE_INSUFFICIENT: 'age',
      EMAIL_INVALID: 'email',
      EMAIL_DUPLICATE: 'email',
      PREMIUM_AGE_INSUFFICIENT: 'age',
      CREDIT_SCORE_TOO_LOW: 'creditScore',
    };
    return fieldMapping[code] || 'general';
  }
}

// user-management.module.ts - NestJS Module with VytchesDDD Integration
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';

@Module({
  controllers: [UserManagementController],
})
export class UserManagementModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);
  }
}
```

## Key Features

- **🔄 Service Locator Pattern**: Enterprise-grade dependency injection with
  VytchesDDD
- **🎯 Policy Behaviors**: Retry, caching, and temporal policy enhancements
- **🌉 Bridge Pattern**: Clean integration between NestJS and VytchesDDD DI
- **⚡ Performance Optimization**: Intelligent caching and retry strategies
- **🏗️ Enterprise Architecture**: Scalable patterns for complex applications

## Advanced Integration Benefits

### **Enterprise Dependency Injection**

- **Service Locator**: Global service resolution with context isolation
- **Auto-Discovery**: Automatic service registration through decorators
- **Lifecycle Management**: Configurable service lifetimes (Singleton,
  Transient, Scoped)

### **Policy Enhancement**

- **Behavior Composition**: Layer retry, caching, and temporal behaviors
- **Cross-Cutting Concerns**: Centralized handling of resilience and performance
- **Context-Aware Policies**: Rich policy execution context and correlation
  tracking

### **Framework Integration**

- **Bridge Pattern**: Clean separation between framework and domain services
- **No Dual Decorators**: Clear distinction between NestJS and VytchesDDD
  services
- **Consistent Patterns**: Unified approach across all domain services

## Common Pitfalls

- **❌ Double Instance Risk**: Always use Bridge Pattern to avoid creating
  duplicate service instances
- **❌ Initialization Order**: Ensure VytchesDDD is configured before NestJS DI
  resolution
- **❌ Context Pollution**: Keep policy contexts clean and focused on business
  concerns
- **❌ Behavior Overuse**: Don't add behaviors unless they provide clear
  business value

## Related Examples

- [Example 2: Policy Registry Integration](./example-2.md) - Advanced policy
  management patterns
- [Basic: Policy Usage](../basic/example-1.md) - Foundation patterns for
  comparison
- [Advanced: Enterprise Policy Orchestration](../advanced/example-1.md) -
  Large-scale policy coordination
