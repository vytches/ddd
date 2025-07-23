# Fluent Policy Builder with Business Rules

**Version**: 2.0.0  
**Package**: @vytches-ddd/policies  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: policy-pattern, fluent-builder, specification-pattern,
business-rules  
**Dependencies**: @vytches-ddd/policies, @vytches-ddd/validation,
@vytches-ddd/utils

## Description

Demonstrates the core Policy Pattern with fluent builder API for creating
declarative business rules. Shows how to build policies that validate complex
business logic using specifications, conditional rules, and violation handling
with enterprise-grade context support.

## Business Context

User registration and management requires complex validation rules that go
beyond simple field validation. Business rules like age requirements, email
verification, role-based permissions, and subscription limits need to be
expressed clearly, tested independently, and evolved over time without impacting
application code.

## Code Example

````typescript
// user-specifications.ts
import { ISpecification, IAsyncSpecification } from '@vytches-ddd/validation';
import { User } from '../types';

/**
 * @llm-summary Specification for validating user age requirements
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Validates that a user meets minimum age requirements for account creation
 * with support for different age thresholds based on account type.
 *
 * @example
 * ```typescript
 * const ageSpec = new AgeSpecification(18);
 * const result = await ageSpec.isSatisfiedByAsync(user);
 * ```
 *
 * @since 2.0.0
 * @public
 */
export class AgeSpecification implements IAsyncSpecification<User> {
  constructor(private readonly minimumAge: number) {}

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    if (!user.profile.dateOfBirth) {
      return false;
    }

    const today = new Date();
    const birthDate = new Date(user.profile.dateOfBirth);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      return age - 1 >= this.minimumAge;
    }

    return age >= this.minimumAge;
  }

  getDescription(): string {
    return `User must be at least ${this.minimumAge} years old`;
  }
}

/**
 * @llm-summary Specification for validating email format and domain
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Validates email format and optionally checks against allowed/blocked domains
 * for enhanced security and business rule compliance.
 *
 * @since 2.0.0
 * @public
 */
export class EmailSpecification implements IAsyncSpecification<User> {
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly blockedDomains = [
    'tempmail.com',
    'guerrillamail.com',
    '10minutemail.com',
  ];

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    if (!user.email) {
      return false;
    }

    // Basic format validation
    if (!this.emailRegex.test(user.email)) {
      return false;
    }

    // Domain blocking
    const domain = user.email.split('@')[1].toLowerCase();
    if (this.blockedDomains.includes(domain)) {
      return false;
    }

    return true;
  }

  getDescription(): string {
    return 'User must have a valid email address from an allowed domain';
  }
}

/**
 * @llm-summary Specification for validating subscription eligibility
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Validates user subscription status and premium feature eligibility
 * based on subscription plan and current status.
 *
 * @since 2.0.0
 * @public
 */
export class SubscriptionEligibilitySpecification
  implements IAsyncSpecification<User>
{
  constructor(private readonly requiredPlan: string) {}

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    if (!user.subscription) {
      return this.requiredPlan === 'free';
    }

    if (user.subscription.status !== 'active') {
      return false;
    }

    const planHierarchy = ['free', 'basic', 'premium', 'enterprise'];
    const userPlanIndex = planHierarchy.indexOf(user.subscription.plan);
    const requiredPlanIndex = planHierarchy.indexOf(this.requiredPlan);

    return userPlanIndex >= requiredPlanIndex;
  }

  getDescription(): string {
    return `User must have ${this.requiredPlan} subscription or higher`;
  }
}
````

````typescript
// user-policies.ts
import { PolicyBuilder, PolicyContext } from '@vytches-ddd/policies';
import { Result } from '@vytches-ddd/utils';
import {
  AgeSpecification,
  EmailSpecification,
  SubscriptionEligibilitySpecification,
} from './user-specifications';
import { User, PolicyResult } from '../types';

/**
 * @llm-summary Fluent policy builder for user registration validation
 * @llm-domain User Management
 * @llm-complexity Medium
 *
 * @description
 * Demonstrates comprehensive user validation policies using fluent builder pattern
 * with specifications, conditional logic, and enterprise context support.
 *
 * @example
 * ```typescript
 * const policy = createUserRegistrationPolicy();
 * const result = await policy.check({ entity: user, context });
 *
 * if (result.isFailure()) {
 *   console.log('Validation failed:', result.error.violations);
 * }
 * ```
 *
 * @since 2.0.0
 * @public
 */
export function createUserRegistrationPolicy() {
  return (
    PolicyBuilder.create<User>()
      .withId('user-registration-policy')
      .withDomain('user-management')
      .withName('User Registration Validation Policy')
      .withDescription('Comprehensive validation for new user registrations')

      // Age requirement validation
      .must(new AgeSpecification(18))
      .withCode('AGE_REQUIREMENT_NOT_MET')
      .withMessage('User must be at least 18 years old to create an account')
      .withSeverity('ERROR')

      .and()

      // Email format and domain validation
      .must(new EmailSpecification())
      .withCode('INVALID_EMAIL_ADDRESS')
      .withMessage(
        'Please provide a valid email address from an allowed domain'
      )
      .withSeverity('ERROR')

      .and()

      // Profile completeness validation
      .mustSatisfyRules(rules =>
        rules
          .forProperty('name', r => r.required().minLength(2).maxLength(100))
          .withCode('INVALID_NAME')
          .withMessage('Name must be between 2 and 100 characters')

          .forProperty('profile.firstName', r => r.required().minLength(1))
          .withCode('MISSING_FIRST_NAME')
          .withMessage('First name is required')

          .forProperty('profile.lastName', r => r.required().minLength(1))
          .withCode('MISSING_LAST_NAME')
          .withMessage('Last name is required')
      )

      .and()

      // Role-based validation
      .when(user => user.role === 'moderator')
      .then()
      .mustSatisfyRules(rules =>
        rules
          .forProperty('profile.bio', r => r.required().minLength(50))
          .withCode('MODERATOR_BIO_REQUIRED')
          .withMessage(
            'Moderators must provide a bio of at least 50 characters'
          )
      )

      .and()

      // Premium user validation
      .when(user => user.role === 'premium')
      .then()
      .must(new SubscriptionEligibilitySpecification('premium'))
      .withCode('PREMIUM_SUBSCRIPTION_REQUIRED')
      .withMessage('Premium role requires active premium subscription')
      .withSeverity('ERROR')

      .build()
  );
}

/**
 * @llm-summary Policy for user profile update validation
 * @llm-domain User Management
 * @llm-complexity Medium
 *
 * @description
 * Validates user profile updates with conditional requirements based on
 * user role, subscription status, and profile completeness.
 *
 * @since 2.0.0
 * @public
 */
export function createUserProfileUpdatePolicy() {
  return (
    PolicyBuilder.create<User>()
      .withId('user-profile-update-policy')
      .withDomain('user-management')
      .withName('User Profile Update Policy')

      // Email updates require re-validation
      .mustAsync(async user => {
        if (user.email) {
          const emailSpec = new EmailSpecification();
          return await emailSpec.isSatisfiedByAsync(user);
        }
        return true;
      })
      .withCode('INVALID_EMAIL_UPDATE')
      .withMessage('Email update requires valid email from allowed domain')
      .withSeverity('ERROR')

      .and()

      // Bio requirements for public profiles
      .when(user => user.profile.bio && user.role === 'moderator')
      .then()
      .mustSatisfyRules(rules =>
        rules
          .forProperty('profile.bio', r => r.minLength(20).maxLength(500))
          .withCode('INVALID_MODERATOR_BIO')
          .withMessage('Moderator bio must be between 20 and 500 characters')
      )

      .otherwise()
      .should(user => !user.profile.bio || user.profile.bio.length <= 200)
      .withCode('BIO_TOO_LONG')
      .withMessage('Bio should not exceed 200 characters for regular users')
      .withSeverity('WARNING')

      .build()
  );
}

/**
 * @llm-summary Advanced policy with async validation and external checks
 * @llm-domain User Management
 * @llm-complexity Medium
 *
 * @description
 * Demonstrates advanced policy features including async validation,
 * external service integration, and complex conditional logic.
 *
 * @since 2.0.0
 * @public
 */
export function createAdvancedUserValidationPolicy() {
  return (
    PolicyBuilder.create<User>()
      .withId('advanced-user-validation-policy')
      .withDomain('user-management')
      .withName('Advanced User Validation Policy')
      .withDescription('Complex validation with external service integration')

      // Credit score validation for premium users
      .when(
        user =>
          user.role === 'premium' && user.profile.creditScore !== undefined
      )
      .then()
      .mustAsync(async user => {
        // Simulate external credit check service
        if (user.profile.creditScore! < 650) {
          return false;
        }

        // Additional async validation logic
        return await validateCreditHistory(user.id);
      })
      .withCode('INSUFFICIENT_CREDIT_SCORE')
      .withMessage('Premium users require a credit score of 650 or higher')
      .withSeverity('ERROR')

      .and()

      // Phone number validation for high-value accounts
      .when(user => user.subscription?.plan === 'enterprise')
      .then()
      .mustAsync(async user => {
        if (!user.profile.phoneNumber) {
          return false;
        }

        // Simulate phone verification service
        return await verifyPhoneNumber(user.profile.phoneNumber);
      })
      .withCode('PHONE_VERIFICATION_REQUIRED')
      .withMessage('Enterprise users must have verified phone numbers')
      .withSeverity('ERROR')

      .and()

      // Geographic restrictions
      .mustAsync(async (user, context) => {
        if (!context.metadata?.ipAddress) {
          return true; // Skip if no IP available
        }

        const country = await getCountryFromIP(context.metadata.ipAddress);
        const restrictedCountries = ['XX', 'YY']; // Example restricted countries

        return !restrictedCountries.includes(country);
      })
      .withCode('GEOGRAPHIC_RESTRICTION')
      .withMessage('Service not available in your geographic location')
      .withSeverity('ERROR')

      .build()
  );
}

// External service simulation functions
async function validateCreditHistory(userId: string): Promise<boolean> {
  // Simulate external credit history validation
  await new Promise(resolve => setTimeout(resolve, 100));
  return Math.random() > 0.1; // 90% pass rate for demo
}

async function verifyPhoneNumber(phoneNumber: string): Promise<boolean> {
  // Simulate phone verification service
  await new Promise(resolve => setTimeout(resolve, 150));
  return phoneNumber.length >= 10;
}

async function getCountryFromIP(ipAddress: string): Promise<string> {
  // Simulate IP geolocation service
  await new Promise(resolve => setTimeout(resolve, 50));
  return 'US'; // Default to US for demo
}
````

```typescript
// policy-usage-examples.ts
import { PolicyContext } from '@vytches-ddd/policies';
import {
  createUserRegistrationPolicy,
  createUserProfileUpdatePolicy,
  createAdvancedUserValidationPolicy,
} from './user-policies';
import { User } from '../types';

/**
 * @llm-summary Comprehensive examples of policy usage and violation handling
 * @llm-domain User Management
 * @llm-complexity Medium
 *
 * @description
 * Demonstrates practical policy usage patterns including context creation,
 * policy evaluation, violation handling, and error reporting.
 *
 * @since 2.0.0
 * @public
 */
export class PolicyUsageExamples {
  /**
   * @llm-summary Example of basic policy evaluation with context
   * @llm-domain User Management
   * @llm-complexity Medium
   *
   * @description
   * Shows standard policy evaluation pattern with comprehensive
   * context creation and violation handling.
   *
   * @param user - User entity to validate
   * @param requestId - Request ID for correlation tracking
   * @returns Promise with validation result
   *
   * @since 2.0.0
   * @public
   */
  async validateNewUserRegistration(
    user: User,
    requestId: string
  ): Promise<PolicyResult<User>> {
    try {
      console.log(`🔍 Validating user registration: ${user.email}`);

      // Create comprehensive policy context
      const context = PolicyContext.create()
        .withUserId(user.id)
        .withRequestId(requestId)
        .withCorrelationId(`user-reg-${Date.now()}`)
        .withTimestamp(new Date())
        .withMetadata({
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.100',
          registrationChannel: 'web',
        })
        .build();

      // Get registration policy and evaluate
      const policy = createUserRegistrationPolicy();
      const result = await policy.check({ entity: user, context });

      if (result.isSuccess()) {
        console.log('✅ User registration validation passed');
        return {
          success: true,
          data: user,
          metadata: {
            policyId: 'user-registration-policy',
            executionTime: Date.now() - context.timestamp.getTime(),
            correlationId: context.correlationId,
          },
        };
      } else {
        console.log('❌ User registration validation failed');

        // Log violations for debugging
        result.error.violations.forEach(violation => {
          console.log(
            `  - ${violation.severity}: ${violation.code} - ${violation.message}`
          );
        });

        return {
          success: false,
          violations: result.error.violations,
          error: 'User registration validation failed',
          metadata: {
            policyId: 'user-registration-policy',
            violationCount: result.error.violations.length,
            correlationId: context.correlationId,
          },
        };
      }
    } catch (error) {
      console.error('❌ Policy evaluation error:', error);

      return {
        success: false,
        error: `Policy evaluation failed: ${error.message}`,
        metadata: {
          errorType: error.constructor.name,
          correlationId: requestId,
        },
      };
    }
  }

  /**
   * @llm-summary Example of conditional policy evaluation
   * @llm-domain User Management
   * @llm-complexity Medium
   *
   * @description
   * Demonstrates conditional policy selection and evaluation based on
   * user characteristics and business context.
   *
   * @param user - User entity to validate
   * @param updateType - Type of profile update being performed
   * @returns Promise with validation result
   *
   * @since 2.0.0
   * @public
   */
  async validateUserProfileUpdate(
    user: User,
    updateType: 'basic' | 'role_change' | 'subscription_upgrade'
  ): Promise<PolicyResult<User>> {
    console.log(`🔄 Validating profile update (${updateType}): ${user.email}`);

    const context = PolicyContext.create()
      .withUserId(user.id)
      .withCorrelationId(`profile-update-${Date.now()}`)
      .withMetadata({
        updateType,
        userRole: user.role,
        subscriptionPlan: user.subscription?.plan || 'free',
      })
      .build();

    let policy;

    // Select appropriate policy based on update type
    switch (updateType) {
      case 'basic':
        policy = createUserProfileUpdatePolicy();
        break;
      case 'role_change':
      case 'subscription_upgrade':
        policy = createAdvancedUserValidationPolicy();
        break;
      default:
        throw new Error(`Unknown update type: ${updateType}`);
    }

    const result = await policy.check({ entity: user, context });

    if (result.isSuccess()) {
      console.log(`✅ Profile update validation passed for ${updateType}`);
      return {
        success: true,
        data: user,
        metadata: {
          policyId: policy.id,
          updateType,
          correlationId: context.correlationId,
        },
      };
    } else {
      console.log(`❌ Profile update validation failed for ${updateType}`);

      // Categorize violations by severity
      const errors = result.error.violations.filter(
        v => v.severity === 'ERROR'
      );
      const warnings = result.error.violations.filter(
        v => v.severity === 'WARNING'
      );

      console.log(`  Errors: ${errors.length}, Warnings: ${warnings.length}`);

      return {
        success: false,
        violations: result.error.violations,
        error: `Profile update validation failed for ${updateType}`,
        metadata: {
          policyId: policy.id,
          updateType,
          errorCount: errors.length,
          warningCount: warnings.length,
          correlationId: context.correlationId,
        },
      };
    }
  }

  /**
   * @llm-summary Example of bulk user validation with performance optimization
   * @llm-domain User Management
   * @llm-complexity Medium
   *
   * @description
   * Shows how to efficiently validate multiple users using batch processing
   * and parallel policy evaluation for performance optimization.
   *
   * @param users - Array of users to validate
   * @param batchId - Batch identifier for correlation tracking
   * @returns Promise with batch validation results
   *
   * @since 2.0.0
   * @public
   */
  async validateUserBatch(
    users: User[],
    batchId: string
  ): Promise<{
    successful: PolicyResult<User>[];
    failed: PolicyResult<User>[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      executionTime: number;
    };
  }> {
    console.log(
      `📊 Validating user batch: ${users.length} users (batch: ${batchId})`
    );

    const startTime = Date.now();
    const policy = createUserRegistrationPolicy();

    // Process users in parallel for better performance
    const validationPromises = users.map(async (user, index) => {
      const context = PolicyContext.create()
        .withUserId(user.id)
        .withCorrelationId(`${batchId}-user-${index}`)
        .withMetadata({
          batchId,
          batchIndex: index,
          batchSize: users.length,
        })
        .build();

      try {
        const result = await policy.check({ entity: user, context });

        if (result.isSuccess()) {
          return {
            success: true,
            data: user,
            metadata: {
              batchIndex: index,
              correlationId: context.correlationId,
            },
          } as PolicyResult<User>;
        } else {
          return {
            success: false,
            violations: result.error.violations,
            error: 'Batch validation failed',
            metadata: {
              batchIndex: index,
              correlationId: context.correlationId,
            },
          } as PolicyResult<User>;
        }
      } catch (error) {
        return {
          success: false,
          error: `Batch validation error: ${error.message}`,
          metadata: {
            batchIndex: index,
            errorType: error.constructor.name,
          },
        } as PolicyResult<User>;
      }
    });

    // Wait for all validations to complete
    const results = await Promise.all(validationPromises);
    const executionTime = Date.now() - startTime;

    // Separate successful and failed validations
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(
      `✅ Batch validation completed: ${successful.length}/${users.length} passed (${executionTime}ms)`
    );

    return {
      successful,
      failed,
      summary: {
        total: users.length,
        passed: successful.length,
        failed: failed.length,
        executionTime,
      },
    };
  }

  /**
   * @llm-summary Example of policy violation analysis and reporting
   * @llm-domain User Management
   * @llm-complexity Medium
   *
   * @description
   * Demonstrates comprehensive violation analysis including categorization,
   * reporting, and actionable recommendations for policy failures.
   *
   * @param violations - Array of policy violations to analyze
   * @returns Detailed violation analysis report
   *
   * @since 2.0.0
   * @public
   */
  analyzePolicyViolations(violations: any[]): {
    summary: {
      total: number;
      bysearity: Record<string, number>;
      byCide: Record<string, number>;
      commonIssues: string[];
    };
    recommendations: string[];
    actionable: {
      field: string;
      issue: string;
      suggestion: string;
    }[];
  } {
    const summary = {
      total: violations.length,
      bySeverity: {} as Record<string, number>,
      byCode: {} as Record<string, number>,
      commonIssues: [] as string[],
    };

    const recommendations: string[] = [];
    const actionable: { field: string; issue: string; suggestion: string }[] =
      [];

    // Analyze violations
    violations.forEach(violation => {
      // Count by severity
      summary.bySeverity[violation.severity] =
        (summary.bySeverity[violation.severity] || 0) + 1;

      // Count by code
      summary.byCode[violation.code] =
        (summary.byCode[violation.code] || 0) + 1;

      // Generate actionable recommendations
      switch (violation.code) {
        case 'AGE_REQUIREMENT_NOT_MET':
          actionable.push({
            field: 'profile.dateOfBirth',
            issue: 'User does not meet minimum age requirement',
            suggestion:
              'Verify date of birth is accurate and user is at least 18 years old',
          });
          break;
        case 'INVALID_EMAIL_ADDRESS':
          actionable.push({
            field: 'email',
            issue: 'Email address format is invalid or from blocked domain',
            suggestion: 'Use a valid email address from an allowed domain',
          });
          break;
        case 'MODERATOR_BIO_REQUIRED':
          actionable.push({
            field: 'profile.bio',
            issue: 'Moderator role requires detailed bio',
            suggestion: 'Add a comprehensive bio of at least 50 characters',
          });
          break;
      }
    });

    // Identify common issues
    const commonThreshold = Math.max(1, Math.floor(violations.length * 0.3));
    summary.commonIssues = Object.entries(summary.byCode)
      .filter(([, count]) => count >= commonThreshold)
      .map(([code]) => code)
      .slice(0, 5);

    // Generate general recommendations
    if (summary.bySeverity.ERROR > 0) {
      recommendations.push(
        'Address all ERROR level violations before proceeding'
      );
    }
    if (summary.bySeverity.WARNING > 0) {
      recommendations.push(
        'Review WARNING level violations to improve data quality'
      );
    }
    if (summary.commonIssues.length > 0) {
      recommendations.push(
        `Focus on common issues: ${summary.commonIssues.join(', ')}`
      );
    }

    return { summary, recommendations, actionable };
  }
}

// Usage demonstration
async function demonstratePolicyUsage(): Promise<void> {
  const examples = new PolicyUsageExamples();

  // Test user data
  const testUser: User = {
    id: 'user-123',
    email: 'john.doe@example.com',
    name: 'John Doe',
    role: 'user',
    status: 'active',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      bio: 'Software developer with passion for clean code',
      dateOfBirth: new Date('1985-06-15'),
      creditScore: 720,
    },
    preferences: {
      notifications: { email: true, sms: false, push: true },
      language: 'en',
      timezone: 'UTC',
      theme: 'dark',
    },
    createdAt: new Date(),
    version: 1,
  };

  console.log('🧪 Running policy usage examples...\n');

  // Example 1: Basic registration validation
  const registrationResult = await examples.validateNewUserRegistration(
    testUser,
    'req-001'
  );
  console.log(
    'Registration result:',
    registrationResult.success ? 'PASSED' : 'FAILED'
  );

  // Example 2: Profile update validation
  const updateResult = await examples.validateUserProfileUpdate(
    testUser,
    'basic'
  );
  console.log('Update result:', updateResult.success ? 'PASSED' : 'FAILED');

  // Example 3: Batch validation
  const users = [
    testUser,
    { ...testUser, id: 'user-124', email: 'jane@example.com' },
  ];
  const batchResult = await examples.validateUserBatch(users, 'batch-001');
  console.log(
    `Batch result: ${batchResult.summary.passed}/${batchResult.summary.total} passed`
  );

  console.log('\n✅ Policy usage examples completed');
}
```

## Key Features

- **🎯 Fluent Builder Pattern**: Expressive API for creating complex business
  rules declaratively
- **📋 Specification Integration**: Direct support for ISpecification pattern
  with async capabilities
- **🔀 Conditional Logic**: Dynamic policy execution with
  `.when().then().otherwise()` patterns
- **📊 Rich Violation System**: Structured violations with severity levels and
  business context
- **🎭 Context-Aware Execution**: Enterprise context support with audit trails
  and correlation tracking
- **⚡ Async Support**: Non-blocking policy evaluation with external service
  integration

## Policy Builder Patterns

1. **Basic Validation**: Simple must/should requirements with error codes and
   messages
2. **Specification Integration**: Direct use of ISpecification and
   IAsyncSpecification implementations
3. **Conditional Policies**: Runtime conditional logic based on entity state and
   context
4. **Rule Composition**: Complex rule combinations with fluent property-based
   validation
5. **Async Validation**: External service integration with timeout and error
   handling

## Violation Handling

### **Severity Levels**

- **ERROR**: Blocking violations that prevent operation completion
- **WARNING**: Non-blocking issues that should be addressed but don't prevent
  success
- **INFO**: Informational violations for logging and analytics

### **Violation Analysis**

- **Field-Level Mapping**: Violations mapped to specific entity fields for UI
  feedback
- **Business Context**: Violations include business-relevant error codes and
  descriptions
- **Actionable Recommendations**: Specific suggestions for resolving policy
  failures
- **Batch Analysis**: Aggregate violation analysis for identifying common issues

## Common Pitfalls

- **❌ Synchronous External Calls**: Always use async specifications for
  external service calls
- **❌ Heavy Validation Logic**: Keep specifications focused and avoid complex
  computation
- **❌ Missing Context**: Always provide comprehensive context for audit and
  debugging
- **❌ Violation Message Quality**: Use clear, actionable violation messages for
  end users

## Related Examples

- [Example 2: Policy Groups and Complex Logic](./example-2.md) - Advanced policy
  composition patterns
- [Example 3: External Service Integration](./example-3.md) - Integration with
  external validation services
- [Intermediate: Policy Behaviors](../intermediate/example-1.md) - Cross-cutting
  concerns with policy behaviors
