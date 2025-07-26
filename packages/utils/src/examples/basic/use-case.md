# Basic Use Cases

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: basic
**Domain**: Infrastructure **Patterns**: Real-world scenarios, practical
applications, common use cases **Dependencies**: @vytches/ddd-utils

## Description

This example demonstrates real-world use cases for the utilities package,
showing how Result patterns, safe execution, and library utilities solve common
development challenges in typical business applications.

## Business Context

Real applications face common challenges:

- User input validation and processing
- API response handling with proper error management
- File processing operations that can fail
- Configuration validation and setup
- Testing error conditions reliably

These use cases show how to address these challenges using the utilities
package.

## Code Example

```typescript
// basic-use-cases.ts
import { Result, safeRun, LibUtils } from '@vytches/ddd-utils';
import {
  UserData,
  ValidationError,
  ApiResponse,
  ServiceResponse,
  CreateUserRequest,
} from '../types';

// ✅ FOCUS: Real-world utility usage scenarios
export class BasicUseCases {
  // USE CASE 1: User Registration Form Processing
  async processUserRegistration(
    formData: CreateUserRequest
  ): Promise<ServiceResponse<UserData>> {
    // Step 1: Validate input data
    const validationResult = this.validateRegistrationData(formData);
    if (validationResult.isFailure) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Registration data is invalid',
          details: validationResult.error,
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      };
    }

    // Step 2: Check if user already exists
    const existsResult = await this.checkUserExists(
      validationResult.value.email
    );
    if (existsResult.isFailure) {
      return {
        success: false,
        error: {
          code: 'CHECK_ERROR',
          message: 'Could not verify user existence',
          details: existsResult.error,
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      };
    }

    if (existsResult.value) {
      return {
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      };
    }

    // Step 3: Create and save user
    const createResult = await this.createAndSaveUser(validationResult.value);

    return createResult.match(
      user => ({
        success: true,
        data: user,
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
          version: '1.0.0',
        },
      }),
      error => ({
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create user',
          details: error,
        },
        metadata: {
          timestamp: new Date(),
          requestId: LibUtils.getUUID(),
        },
      })
    );
  }

  private validateRegistrationData(
    formData: CreateUserRequest
  ): Result<CreateUserRequest, ValidationError> {
    // Validate email
    if (LibUtils.isEmpty(formData.email)) {
      return Result.fail({
        field: 'email',
        message: 'Email is required',
        value: formData.email,
      });
    }

    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      return Result.fail({
        field: 'email',
        message: 'Please enter a valid email address',
        value: formData.email,
      });
    }

    // Validate name
    if (LibUtils.isEmpty(formData.name)) {
      return Result.fail({
        field: 'name',
        message: 'Name is required',
        value: formData.name,
      });
    }

    if (formData.name.trim().length < 2) {
      return Result.fail({
        field: 'name',
        message: 'Name must be at least 2 characters long',
        value: formData.name,
      });
    }

    // Validate password
    if (LibUtils.isEmpty(formData.password)) {
      return Result.fail({
        field: 'password',
        message: 'Password is required',
        value: '[REDACTED]',
      });
    }

    if (formData.password.length < 8) {
      return Result.fail({
        field: 'password',
        message: 'Password must be at least 8 characters long',
        value: '[REDACTED]',
      });
    }

    return Result.ok({
      ...formData,
      email: formData.email.toLowerCase().trim(),
      name: formData.name.trim(),
    });
  }

  private async checkUserExists(
    email: string
  ): Promise<Result<boolean, Error>> {
    return await Result.tryAsync(async () => {
      // Simulate database check
      await LibUtils.sleep(50);

      // Simulate some users existing
      const existingUsers = ['admin@example.com', 'test@example.com'];
      return existingUsers.includes(email.toLowerCase());
    });
  }

  private async createAndSaveUser(
    userData: CreateUserRequest
  ): Promise<Result<UserData, Error>> {
    return await Result.tryAsync(async () => {
      // Simulate user creation process
      await LibUtils.sleep(100);

      const user: UserData = {
        id: LibUtils.getUUID(),
        email: userData.email,
        name: userData.name,
        role: 'user',
        createdAt: new Date(),
      };

      // Simulate potential database error
      if (userData.email === 'error@example.com') {
        throw new Error('Database save failed');
      }

      return user;
    });
  }

  // USE CASE 2: Configuration File Processing
  processConfigFile(configString: string): Result<any, Error> {
    return Result.try(() => {
      // Parse JSON configuration
      const config = JSON.parse(configString);

      // Validate required fields
      if (LibUtils.isEmpty(config.appName)) {
        throw new Error('Configuration missing required field: appName');
      }

      if (LibUtils.isEmpty(config.version)) {
        throw new Error('Configuration missing required field: version');
      }

      // Set defaults for optional fields
      return {
        ...config,
        debug: config.debug || false,
        timeout: config.timeout || 5000,
        retries: config.retries || 3,
      };
    });
  }

  // USE CASE 3: API Response Processing
  processApiResponse<T>(response: ApiResponse<T>): Result<T, Error> {
    if (response.status < 200 || response.status >= 300) {
      return Result.fail(
        new Error(
          `API Error: ${response.status} - ${response.message || 'Unknown error'}`
        )
      );
    }

    if (LibUtils.isEmpty(response.data)) {
      return Result.fail(new Error('API response contains no data'));
    }

    return Result.ok(response.data!);
  }

  // USE CASE 4: Bulk User Processing
  processBulkUsers(userList: Partial<UserData>[]): ServiceResponse<UserData[]> {
    const processedUsers: UserData[] = [];
    const errors: string[] = [];

    userList.forEach((userData, index) => {
      const [processingError, result] = safeRun(() => {
        // Validate each user
        if (LibUtils.isEmpty(userData.email)) {
          throw new Error(`User ${index + 1}: Email is required`);
        }

        if (LibUtils.isEmpty(userData.name)) {
          throw new Error(`User ${index + 1}: Name is required`);
        }

        // Create processed user
        const processedUser: UserData = {
          id: userData.id || LibUtils.getUUID(),
          email: userData.email!.toLowerCase().trim(),
          name: userData.name!.trim(),
          role: userData.role || 'user',
          createdAt: userData.createdAt || new Date(),
        };

        return processedUser;
      });

      if (processingError) {
        errors.push(processingError.message);
      } else if (result) {
        processedUsers.push(result);
      }
    });

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'BULK_PROCESSING_ERROR',
          message: `${errors.length} users failed processing`,
          details: errors,
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

  // USE CASE 5: Data Import Validation
  validateImportData(
    importData: unknown[]
  ): Result<UserData[], ValidationError[]> {
    const validUsers: UserData[] = [];
    const validationErrors: ValidationError[] = [];

    importData.forEach((item, index) => {
      const [validationError, validationResult] = safeRun(() => {
        // Type check
        if (typeof item !== 'object' || item === null) {
          throw new ValidationError(`Row ${index + 1}: Invalid data type`);
        }

        const record = item as any;

        // Required field validation
        if (LibUtils.isEmpty(record.email)) {
          throw new ValidationError(`Row ${index + 1}: Email is required`);
        }

        if (LibUtils.isEmpty(record.name)) {
          throw new ValidationError(`Row ${index + 1}: Name is required`);
        }

        // Format validation
        if (!record.email.includes('@')) {
          throw new ValidationError(`Row ${index + 1}: Invalid email format`);
        }

        // Create valid user
        return {
          id: record.id || LibUtils.getUUID(),
          email: record.email.toLowerCase().trim(),
          name: record.name.trim(),
          role: record.role || 'user',
          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
        } as UserData;
      });

      if (validationError) {
        validationErrors.push({
          field: `row-${index}`,
          message: validationError.message,
          value: item,
        });
      } else if (validationResult) {
        validUsers.push(validationResult);
      }
    });

    if (validationErrors.length > 0) {
      return Result.fail(validationErrors);
    }

    return Result.ok(validUsers);
  }

  // USE CASE 6: System Health Check
  async performHealthCheck(): Promise<ServiceResponse<any>> {
    const healthData: any = {};
    const errors: string[] = [];

    // Check system components
    const checks = [
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'external_api', check: () => this.checkExternalApi() },
      { name: 'file_system', check: () => this.checkFileSystem() },
    ];

    for (const { name, check } of checks) {
      const [error, result] = await safeRun(async () => await check());

      if (error) {
        errors.push(`${name}: ${error.message}`);
        healthData[name] = { status: 'error', message: error.message };
      } else {
        healthData[name] = { status: 'ok', ...result };
      }
    }

    const overallHealthy = errors.length === 0;

    return {
      success: overallHealthy,
      data: {
        status: overallHealthy ? 'healthy' : 'degraded',
        components: healthData,
        timestamp: new Date(),
      },
      error:
        errors.length > 0
          ? {
              code: 'HEALTH_CHECK_FAILED',
              message: `${errors.length} components are unhealthy`,
              details: errors,
            }
          : undefined,
      metadata: {
        timestamp: new Date(),
        requestId: LibUtils.getUUID(),
      },
    };
  }

  private async checkDatabase(): Promise<any> {
    await LibUtils.sleep(50);
    return { responseTime: '50ms', connections: 10 };
  }

  private async checkExternalApi(): Promise<any> {
    await LibUtils.sleep(30);
    return { responseTime: '30ms', status: 'available' };
  }

  private async checkFileSystem(): Promise<any> {
    await LibUtils.sleep(10);
    return { freeSpace: '1GB', permissions: 'ok' };
  }
}

// Custom ValidationError class for use cases
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

## Real-World Scenarios

### 1. User Registration

- Input validation with detailed error messages
- Duplicate checking with database operations
- Safe error handling without exceptions

### 2. Configuration Processing

- JSON parsing with proper error handling
- Required field validation
- Default value assignment

### 3. API Integration

- Response status validation
- Data extraction with safety checks
- Consistent error handling

### 4. Bulk Operations

- Processing multiple items safely
- Error collection without stopping entire operation
- Detailed error reporting

### 5. Data Import

- Type checking and validation
- Row-level error tracking
- Partial success handling

### 6. System Monitoring

- Multiple service health checks
- Graceful degradation handling
- Comprehensive status reporting

## Key Benefits

- **Reliability**: Operations fail safely without crashing
- **Transparency**: All error conditions are explicit and handled
- **Maintainability**: Consistent patterns across different use cases
- **Testability**: Easy to test both success and failure scenarios
- **User Experience**: Detailed, actionable error messages

## Best Practices

- **Always validate input data** before processing
- **Use Result pattern** for operations that can fail
- **Provide meaningful error messages** for users
- **Handle partial failures** in bulk operations
- **Use safe execution** for testing error conditions

## Common Use Cases

- Form validation and processing
- File upload and processing
- API integration and response handling
- Configuration file processing
- Bulk data operations
- System health monitoring
- Data import/export operations

## Related Examples

- [Result Pattern Fundamentals](./example-1.md)
- [Safe Execution with safeRun](./example-2.md)
- [Library Utilities](./example-3.md)
- [Basic Implementation Guide](./implementation.md)
