# Error Aggregation Patterns

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: intermediate
**Domain**: Infrastructure **Patterns**: Error collection, validation
aggregation, bulk processing **Dependencies**: @vytches/ddd-utils

## Description

Advanced error aggregation patterns for collecting, categorizing, and managing
multiple errors from batch operations, complex validation scenarios, and
multi-step processes. This example demonstrates how to handle scenarios where
multiple operations can fail independently.

## Business Context

In real-world applications, you often need to:

- Validate multiple fields and collect all errors at once
- Process bulk data and report all failures
- Run multiple independent operations and aggregate results
- Handle partial failures in complex workflows
- Provide comprehensive error reporting to users

Error aggregation patterns ensure that users receive complete feedback about all
issues rather than just the first error encountered.

## Code Example

```typescript
// error-aggregation-patterns.ts
import { Result, safeRun, LibUtils } from '@vytches/ddd-utils';
import {
  UserData,
  ValidationError,
  AggregatedError,
  ServiceResponse,
  CreateUserRequest,
} from '../types';

// ✅ FOCUS: Error aggregation and collection patterns
export class ErrorAggregationPatterns {
  // 1. Multi-Field Validation with Error Collection
  validateUserComprehensively(
    userData: CreateUserRequest
  ): Result<CreateUserRequest, ValidationError[]> {
    const errors: ValidationError[] = [];

    // Collect all validation errors instead of stopping at first
    const [emailError] = safeRun(() => this.validateEmailField(userData.email));
    if (emailError) {
      errors.push({
        field: 'email',
        message: emailError.message,
        value: userData.email,
      });
    }

    const [nameError] = safeRun(() => this.validateNameField(userData.name));
    if (nameError) {
      errors.push({
        field: 'name',
        message: nameError.message,
        value: userData.name,
      });
    }

    const [passwordError] = safeRun(() =>
      this.validatePasswordField(userData.password)
    );
    if (passwordError) {
      errors.push({
        field: 'password',
        message: passwordError.message,
        value: '[REDACTED]',
      });
    }

    // Additional business rule validations
    const businessErrors = this.validateBusinessRules(userData);
    errors.push(...businessErrors);

    if (errors.length > 0) {
      return Result.fail(errors);
    }

    // Return sanitized data
    return Result.ok({
      email: userData.email.toLowerCase().trim(),
      name: userData.name.trim(),
      password: userData.password, // Would be hashed in real app
    });
  }

  private validateEmailField(email: string): void {
    if (LibUtils.isEmpty(email)) {
      throw new Error('Email is required');
    }
    if (!email.includes('@')) {
      throw new Error('Email must contain @ symbol');
    }
    if (!email.includes('.')) {
      throw new Error('Email must contain a domain');
    }
    if (email.length > 254) {
      throw new Error('Email is too long');
    }
  }

  private validateNameField(name: string): void {
    if (LibUtils.isEmpty(name)) {
      throw new Error('Name is required');
    }
    if (name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    if (name.trim().length > 100) {
      throw new Error('Name cannot exceed 100 characters');
    }
    if (!/^[a-zA-Z\s'-]+$/.test(name)) {
      throw new Error(
        'Name can only contain letters, spaces, hyphens, and apostrophes'
      );
    }
  }

  private validatePasswordField(password: string): void {
    if (LibUtils.isEmpty(password)) {
      throw new Error('Password is required');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (password.length > 128) {
      throw new Error('Password cannot exceed 128 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  private validateBusinessRules(
    userData: CreateUserRequest
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Business rule: No admin emails for regular signup
    if (userData.email.toLowerCase().includes('admin')) {
      errors.push({
        field: 'email',
        message:
          'Admin email addresses are not allowed for regular registration',
        value: userData.email,
      });
    }

    // Business rule: Name cannot be common test names
    const testNames = ['test', 'testing', 'demo', 'example'];
    if (testNames.some(test => userData.name.toLowerCase().includes(test))) {
      errors.push({
        field: 'name',
        message: 'Test names are not allowed',
        value: userData.name,
      });
    }

    // Business rule: Password cannot contain email username
    const emailUsername = userData.email.split('@')[0];
    if (userData.password.toLowerCase().includes(emailUsername.toLowerCase())) {
      errors.push({
        field: 'password',
        message: 'Password cannot contain your email username',
        value: '[REDACTED]',
      });
    }

    return errors;
  }

  // 2. Bulk Data Processing with Error Aggregation
  processBulkUsers(
    userRequests: CreateUserRequest[]
  ): ServiceResponse<UserData[]> {
    const processedUsers: UserData[] = [];
    const processingErrors: Array<{
      index: number;
      errors: ValidationError[];
    }> = [];
    let globalErrors: string[] = [];

    // Process each user and collect all errors
    userRequests.forEach((userRequest, index) => {
      const validationResult = this.validateUserComprehensively(userRequest);

      if (validationResult.isFailure) {
        processingErrors.push({
          index,
          errors: validationResult.error.map(error => ({
            ...error,
            field: `users[${index}].${error.field}`,
          })),
        });
      } else {
        // Additional processing that might fail
        const [processingError, processedUser] = safeRun(() =>
          this.createProcessedUser(validationResult.value, index)
        );

        if (processingError) {
          globalErrors.push(`User ${index}: ${processingError.message}`);
        } else if (processedUser) {
          processedUsers.push(processedUser);
        }
      }
    });

    // Aggregate all errors for reporting
    if (processingErrors.length > 0 || globalErrors.length > 0) {
      const allValidationErrors = processingErrors.flatMap(pe => pe.errors);

      return {
        success: false,
        error: {
          code: 'BULK_PROCESSING_FAILED',
          message: `${processingErrors.length + globalErrors.length} users failed processing`,
          details: {
            validationErrors: allValidationErrors,
            processingErrors: globalErrors,
            successfulCount: processedUsers.length,
            totalCount: userRequests.length,
          },
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      };
    }

    return {
      success: true,
      data: processedUsers,
      metadata: {
        timestamp: new Date(),
        requestId: LibUtils.getUUID(),
        version: '1.0.0',
        processedCount: processedUsers.length,
      },
    };
  }

  private createProcessedUser(
    validatedRequest: CreateUserRequest,
    index: number
  ): UserData {
    // Simulate processing that might fail for specific cases
    if (validatedRequest.email.includes('processingfail')) {
      throw new Error(`Processing failed for user data at index ${index}`);
    }

    return {
      id: LibUtils.getUUID(),
      email: validatedRequest.email,
      name: validatedRequest.name,
      role: 'user',
      createdAt: new Date(),
    };
  }

  // 3. Multi-Step Operation with Error Accumulation
  async processUserAccountSetup(
    userData: CreateUserRequest
  ): Promise<ServiceResponse<any>> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const results: any = {};

    // Step 1: User validation
    const validationResult = this.validateUserComprehensively(userData);
    if (validationResult.isFailure) {
      errors.push(
        ...validationResult.error.map(e => `Validation: ${e.message}`)
      );
    } else {
      results.validatedData = validationResult.value;
    }

    // Step 2: Create user (only if validation passed)
    if (validationResult.isSuccess) {
      const [userCreationError, createdUser] = await safeRun(
        async () => await this.createUserAccount(validationResult.value)
      );

      if (userCreationError) {
        errors.push(`User Creation: ${userCreationError.message}`);
      } else {
        results.user = createdUser;
      }
    }

    // Step 3: Set up user profile (continue even if user creation failed)
    if (results.user) {
      const [profileError, profile] = await safeRun(
        async () => await this.setupUserProfile(results.user.id)
      );

      if (profileError) {
        warnings.push(`Profile Setup: ${profileError.message}`);
      } else {
        results.profile = profile;
      }
    }

    // Step 4: Send welcome email (non-critical)
    if (results.user) {
      const [emailError] = await safeRun(
        async () => await this.sendWelcomeEmail(results.user.email)
      );

      if (emailError) {
        warnings.push(`Welcome Email: ${emailError.message}`);
      } else {
        results.welcomeEmailSent = true;
      }
    }

    // Determine overall success/failure
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    if (hasErrors) {
      return {
        success: false,
        error: {
          code: 'ACCOUNT_SETUP_FAILED',
          message: `Account setup failed with ${errors.length} errors and ${warnings.length} warnings`,
          details: { errors, warnings, partialResults: results },
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
        warnings: hasWarnings ? warnings : undefined,
      },
    };
  }

  private async createUserAccount(
    userData: CreateUserRequest
  ): Promise<UserData> {
    await LibUtils.sleep(100);

    if (userData.email === 'createfail@example.com') {
      throw new Error('Database connection failed during user creation');
    }

    return {
      id: LibUtils.getUUID(),
      email: userData.email,
      name: userData.name,
      role: 'user',
      createdAt: new Date(),
    };
  }

  private async setupUserProfile(userId: string): Promise<any> {
    await LibUtils.sleep(50);

    if (userId.includes('profilefail')) {
      throw new Error('Profile service unavailable');
    }

    return {
      userId,
      bio: '',
      preferences: { theme: 'light', notifications: true },
      createdAt: new Date(),
    };
  }

  private async sendWelcomeEmail(email: string): Promise<void> {
    await LibUtils.sleep(30);

    if (email.includes('noemail')) {
      throw new Error('Email service temporarily unavailable');
    }
  }

  // 4. Error Categorization and Reporting
  categorizeAndReportErrors(errors: ValidationError[]): any {
    const categorized = {
      required: errors.filter(e =>
        e.message.toLowerCase().includes('required')
      ),
      format: errors.filter(
        e =>
          e.message.toLowerCase().includes('format') ||
          e.message.toLowerCase().includes('invalid')
      ),
      length: errors.filter(
        e =>
          e.message.toLowerCase().includes('length') ||
          e.message.toLowerCase().includes('characters') ||
          e.message.toLowerCase().includes('too long') ||
          e.message.toLowerCase().includes('too short')
      ),
      business: errors.filter(
        e =>
          !e.message.toLowerCase().includes('required') &&
          !e.message.toLowerCase().includes('format') &&
          !e.message.toLowerCase().includes('invalid') &&
          !e.message.toLowerCase().includes('length') &&
          !e.message.toLowerCase().includes('characters')
      ),
    };

    const summary = {
      total: errors.length,
      byCategory: {
        required: categorized.required.length,
        format: categorized.format.length,
        length: categorized.length.length,
        business: categorized.business.length,
      },
      byField: this.groupErrorsByField(errors),
      suggestions: this.generateErrorSuggestions(categorized),
    };

    return { categorized, summary };
  }

  private groupErrorsByField(
    errors: ValidationError[]
  ): Record<string, number> {
    return errors.reduce(
      (acc, error) => {
        const field = error.field.split('[')[0].split('.').pop() || error.field;
        acc[field] = (acc[field] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private generateErrorSuggestions(categorized: any): string[] {
    const suggestions: string[] = [];

    if (categorized.required.length > 0) {
      suggestions.push('Please fill in all required fields');
    }

    if (categorized.format.length > 0) {
      suggestions.push('Please check the format of your input data');
    }

    if (categorized.length.length > 0) {
      suggestions.push('Please check the length requirements for your input');
    }

    if (categorized.business.length > 0) {
      suggestions.push('Please review the business rules and requirements');
    }

    return suggestions;
  }

  // 5. Progressive Error Recovery
  processWithRecovery(userRequests: CreateUserRequest[]): ServiceResponse<any> {
    const results = {
      successful: [] as UserData[],
      recovered: [] as UserData[],
      failed: [] as { request: CreateUserRequest; errors: ValidationError[] }[],
    };

    userRequests.forEach(request => {
      // Try standard processing first
      const standardResult = this.validateUserComprehensively(request);

      if (standardResult.isSuccess) {
        const [creationError, user] = safeRun(() =>
          this.createProcessedUser(standardResult.value, 0)
        );

        if (!creationError && user) {
          results.successful.push(user);
          return;
        }
      }

      // Try recovery with relaxed validation
      const recoveryResult = this.tryRecoveryValidation(request);
      if (recoveryResult.isSuccess) {
        const [recoveryCreationError, recoveredUser] = safeRun(() =>
          this.createProcessedUser(recoveryResult.value, 0)
        );

        if (!recoveryCreationError && recoveredUser) {
          results.recovered.push(recoveredUser);
          return;
        }
      }

      // Record failure
      results.failed.push({
        request,
        errors: standardResult.isFailure ? standardResult.error : [],
      });
    });

    const totalProcessed = results.successful.length + results.recovered.length;
    const hasPartialSuccess = totalProcessed > 0 && results.failed.length > 0;

    return {
      success: results.failed.length === 0,
      data: {
        results,
        summary: {
          total: userRequests.length,
          successful: results.successful.length,
          recovered: results.recovered.length,
          failed: results.failed.length,
          successRate: totalProcessed / userRequests.length,
        },
      },
      error:
        results.failed.length > 0
          ? {
              code: hasPartialSuccess ? 'PARTIAL_FAILURE' : 'PROCESSING_FAILED',
              message: `${results.failed.length} users failed processing`,
              details: results.failed,
            }
          : undefined,
      metadata: {
        timestamp: new Date(),
        requestId: LibUtils.getUUID(),
        processingMode: 'recovery',
      },
    };
  }

  private tryRecoveryValidation(
    request: CreateUserRequest
  ): Result<CreateUserRequest, ValidationError[]> {
    // Relaxed validation for recovery scenarios
    const errors: ValidationError[] = [];

    // Only check absolutely critical fields
    if (LibUtils.isEmpty(request.email) || !request.email.includes('@')) {
      errors.push({
        field: 'email',
        message: 'Valid email is required for recovery',
        value: request.email,
      });
    }

    if (LibUtils.isEmpty(request.name)) {
      errors.push({
        field: 'name',
        message: 'Name is required for recovery',
        value: request.name,
      });
    }

    if (errors.length > 0) {
      return Result.fail(errors);
    }

    // Return with defaults for missing data
    return Result.ok({
      email: request.email.toLowerCase().trim(),
      name: request.name.trim(),
      password: request.password || 'temp-password-reset-required',
    });
  }
}
```

## Key Features

- **Comprehensive Validation**: Collect all validation errors instead of
  stopping at first
- **Bulk Processing**: Handle multiple items with detailed error reporting
- **Multi-Step Operations**: Continue processing and collect errors from each
  step
- **Error Categorization**: Group errors by type and field for better reporting
- **Progressive Recovery**: Attempt recovery with relaxed validation
- **Detailed Reporting**: Provide comprehensive error summaries and suggestions

## Usage Examples

```typescript
const processor = new ErrorAggregationPatterns();

// Comprehensive validation
const userData = { email: 'invalid', name: 'A', password: 'weak' };
const validationResult = processor.validateUserComprehensively(userData);

if (validationResult.isFailure) {
  console.log('Validation errors:', validationResult.error);

  // Categorize errors for better reporting
  const report = processor.categorizeAndReportErrors(validationResult.error);
  console.log('Error report:', report.summary);
}

// Bulk processing
const userList = [
  { email: 'user1@example.com', name: 'User One', password: 'SecurePass123!' },
  { email: 'invalid-email', name: 'User Two', password: 'weak' },
];

const bulkResult = processor.processBulkUsers(userList);
if (bulkResult.success) {
  console.log('All users processed successfully');
} else {
  console.log('Bulk processing errors:', bulkResult.error?.details);
}

// Multi-step with recovery
const recoveryResult = processor.processWithRecovery(userList);
console.log('Recovery summary:', recoveryResult.data.summary);
```

## Common Pitfalls

- **Stopping at first error**: Always collect all errors for better user
  experience
- **Poor error categorization**: Group errors logically for actionable feedback
- **No recovery mechanisms**: Provide fallback options for partial failures
- **Overwhelming error reports**: Summarize and prioritize errors for users

## Related Examples

- [Result Pattern Fundamentals](../basic/example-1.md)
- [Advanced Result Patterns](./example-1.md)
- [Basic Implementation Guide](../basic/implementation.md)
