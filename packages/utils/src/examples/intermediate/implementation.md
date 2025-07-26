# Intermediate Implementation Guide

**Version**: 1.0.0 **Package**: @vytches/ddd-utils **Complexity**: intermediate
**Domain**: Infrastructure **Patterns**: Advanced implementation strategies,
architectural patterns, system integration **Dependencies**: @vytches/ddd-utils

## Description

Advanced implementation strategies for integrating utilities into complex
application architectures. This guide covers sophisticated patterns for Result
handling, error aggregation, asynchronous operations, and system-wide utility
integration.

## Business Context

As applications grow in complexity, utility integration needs to address:

- Multi-layered architectures with service boundaries
- Asynchronous workflows with complex error handling
- Bulk operations with partial failure handling
- Cross-cutting concerns like logging, monitoring, and recovery
- Integration with external systems and APIs

This guide provides architectural patterns for implementing utilities at
enterprise scale.

## Code Example

```typescript
// intermediate-implementation.ts
import { Result, safeRun, LibUtils } from '@vytches/ddd-utils';
import {
  UserData,
  ValidationError,
  ServiceResponse,
  AggregatedError,
  AsyncResult
} from '../types';

// ✅ FOCUS: Advanced implementation patterns
export class IntermediateImplementation {

  // 1. Service Layer Implementation with Result Patterns
  class UserService {
    private auditLog: any[] = [];
    private eventBus: any;

    constructor(eventBus: any) {
      this.eventBus = eventBus;
    }

    async createUser(userData: Partial<UserData>): Promise<ServiceResponse<UserData>> {
      const operationId = LibUtils.getUUID();
      const startTime = Date.now();

      try {
        // Step 1: Input validation with comprehensive error collection
        const validationResult = this.validateUserInput(userData);
        if (validationResult.isFailure) {
          await this.logOperation(operationId, 'VALIDATION_FAILED', { errors: validationResult.error });

          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'User data validation failed',
              details: {
                errors: validationResult.error,
                operationId,
                timestamp: new Date(),
              },
            },
            metadata: {
              timestamp: new Date(),
              requestId: operationId,
              duration: Date.now() - startTime,
            },
          };
        }

        const validUser = validationResult.value;

        // Step 2: Business rules validation
        const businessRulesResult = await this.applyBusinessRules(validUser);
        if (businessRulesResult.isFailure) {
          await this.logOperation(operationId, 'BUSINESS_RULES_FAILED', { error: businessRulesResult.error });

          return {
            success: false,
            error: {
              code: 'BUSINESS_RULE_VIOLATION',
              message: businessRulesResult.error.message,
              details: { operationId },
            },
            metadata: {
              timestamp: new Date(),
              requestId: operationId,
              duration: Date.now() - startTime,
            },
          };
        }

        // Step 3: Persistence with transaction safety
        const persistenceResult = await this.persistUser(businessRulesResult.value);
        if (persistenceResult.isFailure) {
          await this.logOperation(operationId, 'PERSISTENCE_FAILED', { error: persistenceResult.error });

          return {
            success: false,
            error: {
              code: 'PERSISTENCE_ERROR',
              message: 'Failed to save user',
              details: { operationId, originalError: persistenceResult.error.message },
            },
            metadata: {
              timestamp: new Date(),
              requestId: operationId,
              duration: Date.now() - startTime,
            },
          };
        }

        const savedUser = persistenceResult.value;

        // Step 4: Post-creation activities (non-blocking)
        this.performPostCreationActivities(savedUser, operationId);

        await this.logOperation(operationId, 'SUCCESS', { userId: savedUser.id });

        return {
          success: true,
          data: savedUser,
          metadata: {
            timestamp: new Date(),
            requestId: operationId,
            duration: Date.now() - startTime,
            version: '1.0.0',
          },
        };

      } catch (error) {
        await this.logOperation(operationId, 'UNEXPECTED_ERROR', { error: (error as Error).message });

        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: { operationId },
          },
          metadata: {
            timestamp: new Date(),
            requestId: operationId,
            duration: Date.now() - startTime,
          },
        };
      }
    }

    private validateUserInput(userData: Partial<UserData>): Result<UserData, ValidationError[]> {
      const errors: ValidationError[] = [];

      // Email validation
      if (LibUtils.isEmpty(userData.email)) {
        errors.push({ field: 'email', message: 'Email is required', value: userData.email });
      } else if (!userData.email.includes('@')) {
        errors.push({ field: 'email', message: 'Invalid email format', value: userData.email });
      }

      // Name validation
      if (LibUtils.isEmpty(userData.name)) {
        errors.push({ field: 'name', message: 'Name is required', value: userData.name });
      } else if (userData.name.trim().length < 2) {
        errors.push({ field: 'name', message: 'Name too short', value: userData.name });
      }

      if (errors.length > 0) {
        return Result.fail(errors);
      }

      return Result.ok({
        id: userData.id || LibUtils.getUUID(),
        email: userData.email!.toLowerCase().trim(),
        name: userData.name!.trim(),
        role: userData.role || 'user',
        createdAt: new Date(),
      });
    }

    private async applyBusinessRules(userData: UserData): Promise<Result<UserData, Error>> {
      return await Result.tryAsync(async () => {
        // Check for duplicate email
        const existingUser = await this.findUserByEmail(userData.email);
        if (existingUser) {
          throw new Error('Email already exists');
        }

        // Apply role-specific rules
        if (userData.role === 'admin' && !userData.email.endsWith('@company.com')) {
          throw new Error('Admin users must have company email');
        }

        return userData;
      });
    }

    private async findUserByEmail(email: string): Promise<UserData | null> {
      // Simulate database lookup
      await LibUtils.sleep(50);

      // For demo: certain emails "exist"
      const existingEmails = ['admin@company.com', 'test@example.com'];
      if (existingEmails.includes(email)) {
        return {
          id: 'existing-1',
          email,
          name: 'Existing User',
          role: 'user',
          createdAt: new Date(),
        };
      }

      return null;
    }

    private async persistUser(userData: UserData): Promise<Result<UserData, Error>> {
      return await Result.tryAsync(async () => {
        // Simulate database operation
        await LibUtils.sleep(100);

        if (userData.email === 'fail@example.com') {
          throw new Error('Database connection failed');
        }

        return {
          ...userData,
          id: LibUtils.getUUID(),
          createdAt: new Date(),
        };
      });
    }

    private async performPostCreationActivities(user: UserData, operationId: string): Promise<void> {
      // Run these activities in background without blocking response
      const activities = [
        () => this.sendWelcomeEmail(user.email),
        () => this.createUserProfile(user.id),
        () => this.setupDefaultPermissions(user.id),
        () => this.notifyAdmins(user),
      ];

      // Execute activities concurrently
      const results = await Promise.allSettled(
        activities.map(activity => safeRun(async () => await activity()))
      );

      // Log any failures for monitoring
      results.forEach((result, index) => {
        if (result.status === 'rejected' ||
            (result.status === 'fulfilled' && result.value[0])) {
          const error = result.status === 'rejected' ? result.reason : result.value[0];
          this.logOperation(operationId, `POST_ACTIVITY_${index}_FAILED`, { error: error.message });
        }
      });
    }

    private async sendWelcomeEmail(email: string): Promise<void> {
      await LibUtils.sleep(200);
      if (email.includes('noemail')) {
        throw new Error('Email service unavailable');
      }
    }

    private async createUserProfile(userId: string): Promise<void> {
      await LibUtils.sleep(150);
      if (userId.includes('noprofile')) {
        throw new Error('Profile service error');
      }
    }

    private async setupDefaultPermissions(userId: string): Promise<void> {
      await LibUtils.sleep(100);
      if (userId.includes('noperms')) {
        throw new Error('Permission service error');
      }
    }

    private async notifyAdmins(user: UserData): Promise<void> {
      await LibUtils.sleep(50);
      if (user.email.includes('nonotify')) {
        throw new Error('Notification service error');
      }
    }

    private async logOperation(operationId: string, status: string, details: any): Promise<void> {
      this.auditLog.push({
        operationId,
        status,
        details,
        timestamp: new Date(),
      });

      // Emit event for external systems
      if (this.eventBus) {
        await safeRun(async () => {
          await this.eventBus.emit('user.operation', {
            operationId,
            status,
            details,
            timestamp: new Date(),
          });
        });
      }
    }
  }

  // 2. Batch Processing Service with Sophisticated Error Handling
  class BulkUserProcessingService {
    private readonly batchSize: number;
    private readonly maxConcurrency: number;

    constructor(batchSize: number = 10, maxConcurrency: number = 3) {
      this.batchSize = batchSize;
      this.maxConcurrency = maxConcurrency;
    }

    async processBulkUsers(
      userDataList: Partial<UserData>[],
      options: {
        continueOnError?: boolean;
        enableRecovery?: boolean;
        progressCallback?: (progress: any) => void;
      } = {}
    ): Promise<ServiceResponse<any>> {
      const startTime = Date.now();
      const operationId = LibUtils.getUUID();

      const results = {
        successful: [] as UserData[],
        failed: [] as { index: number; data: Partial<UserData>; errors: ValidationError[] }[],
        recovered: [] as UserData[],
        summary: {
          total: userDataList.length,
          processed: 0,
          successful: 0,
          failed: 0,
          recovered: 0,
        },
      };

      try {
        // Process in batches to manage memory and concurrency
        for (let i = 0; i < userDataList.length; i += this.batchSize) {
          const batch = userDataList.slice(i, i + this.batchSize);
          const batchResults = await this.processBatch(batch, i, options);

          // Aggregate results
          results.successful.push(...batchResults.successful);
          results.failed.push(...batchResults.failed);
          results.recovered.push(...batchResults.recovered);

          // Update progress
          results.summary.processed += batch.length;
          results.summary.successful = results.successful.length;
          results.summary.failed = results.failed.length;
          results.summary.recovered = results.recovered.length;

          // Report progress
          if (options.progressCallback) {
            options.progressCallback({
              ...results.summary,
              completionPercentage: (results.summary.processed / results.summary.total) * 100,
              estimatedTimeRemaining: this.estimateTimeRemaining(
                startTime,
                results.summary.processed,
                results.summary.total
              ),
            });
          }

          // Add delay between batches to be kind to external services
          if (i + this.batchSize < userDataList.length) {
            await LibUtils.sleep(100);
          }
        }

        const hasErrors = results.failed.length > 0;
        const hasPartialSuccess = results.successful.length > 0 || results.recovered.length > 0;

        return {
          success: !hasErrors || (hasErrors && hasPartialSuccess && options.continueOnError),
          data: results,
          error: hasErrors ? {
            code: hasPartialSuccess ? 'PARTIAL_FAILURE' : 'BULK_PROCESSING_FAILED',
            message: `${results.failed.length} users failed processing`,
            details: {
              failedUsers: results.failed.slice(0, 10), // Limit error details
              totalFailed: results.failed.length,
            },
          } : undefined,
          metadata: {
            timestamp: new Date(),
            requestId: operationId,
            duration: Date.now() - startTime,
            batchSize: this.batchSize,
            maxConcurrency: this.maxConcurrency,
          },
        };

      } catch (error) {
        return {
          success: false,
          error: {
            code: 'BULK_PROCESSING_ERROR',
            message: 'Bulk processing failed unexpectedly',
            details: { operationId, error: (error as Error).message },
          },
          metadata: {
            timestamp: new Date(),
            requestId: operationId,
            duration: Date.now() - startTime,
          },
        };
      }
    }

    private async processBatch(
      batch: Partial<UserData>[],
      startIndex: number,
      options: any
    ): Promise<any> {
      const batchResults = {
        successful: [] as UserData[],
        failed: [] as any[],
        recovered: [] as UserData[],
      };

      // Process items concurrently within batch
      const batchPromises = batch.map(async (userData, batchIndex) => {
        const globalIndex = startIndex + batchIndex;

        // Primary processing attempt
        const primaryResult = await this.processUserWithRecovery(userData, globalIndex);

        if (primaryResult.isSuccess) {
          return { type: 'success', data: primaryResult.value, index: globalIndex };
        }

        // Recovery attempt if enabled
        if (options.enableRecovery) {
          const recoveryResult = await this.attemptRecoveryProcessing(userData, globalIndex);
          if (recoveryResult.isSuccess) {
            return { type: 'recovered', data: recoveryResult.value, index: globalIndex };
          }
        }

        return {
          type: 'failed',
          data: userData,
          errors: primaryResult.error,
          index: globalIndex
        };
      });

      // Use limited concurrency to avoid overwhelming systems
      const results = await this.processConcurrently(batchPromises, this.maxConcurrency);

      // Categorize results
      results.forEach(result => {
        switch (result.type) {
          case 'success':
            batchResults.successful.push(result.data);
            break;
          case 'recovered':
            batchResults.recovered.push(result.data);
            break;
          case 'failed':
            batchResults.failed.push({
              index: result.index,
              data: result.data,
              errors: result.errors,
            });
            break;
        }
      });

      return batchResults;
    }

    private async processUserWithRecovery(userData: Partial<UserData>, index: number): Promise<Result<UserData, ValidationError[]>> {
      const [processingError, result] = await safeRun(async () => {
        // Simulate user processing
        const userService = new (this as any).UserService(null);
        return await userService.createUser(userData);
      });

      if (processingError) {
        return Result.fail([{
          field: 'processing',
          message: `Processing failed at index ${index}: ${processingError.message}`,
          value: userData,
        }]);
      }

      if (result?.success) {
        return Result.ok(result.data);
      }

      return Result.fail([{
        field: 'service',
        message: result?.error?.message || 'Service error',
        value: userData,
      }]);
    }

    private async attemptRecoveryProcessing(userData: Partial<UserData>, index: number): Promise<Result<UserData, ValidationError[]>> {
      // Simplified processing with relaxed validation
      const [recoveryError, recoveredUser] = await safeRun(async () => {
        // Apply minimal validation and defaults
        const recoveredData: UserData = {
          id: LibUtils.getUUID(),
          email: userData.email || `recovered-${index}@example.com`,
          name: userData.name || `Recovered User ${index}`,
          role: 'user',
          createdAt: new Date(),
        };

        // Simulate recovery processing
        await LibUtils.sleep(50);
        return recoveredData;
      });

      if (recoveryError) {
        return Result.fail([{
          field: 'recovery',
          message: `Recovery failed: ${recoveryError.message}`,
          value: userData,
        }]);
      }

      return Result.ok(recoveredUser);
    }

    private async processConcurrently<T>(promises: Promise<T>[], concurrency: number): Promise<T[]> {
      const results: T[] = [];

      for (let i = 0; i < promises.length; i += concurrency) {
        const batch = promises.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
      }

      return results;
    }

    private estimateTimeRemaining(startTime: number, processed: number, total: number): number {
      if (processed === 0) return 0;

      const elapsedTime = Date.now() - startTime;
      const averageTimePerItem = elapsedTime / processed;
      const remainingItems = total - processed;

      return Math.round(remainingItems * averageTimePerItem);
    }
  }

  // 3. System Integration Layer
  class UtilityIntegrationLayer {
    private services: Map<string, any> = new Map();
    private interceptors: Array<(operation: string, data: any) => Promise<any>> = [];

    registerService(name: string, service: any): void {
      this.services.set(name, service);
    }

    addInterceptor(interceptor: (operation: string, data: any) => Promise<any>): void {
      this.interceptors.push(interceptor);
    }

    async executeWithInterception<T>(
      serviceName: string,
      operation: string,
      data: any
    ): Promise<Result<T, Error>> {
      const operationId = LibUtils.getUUID();
      const startTime = Date.now();

      try {
        // Pre-processing interceptors
        let processedData = data;
        for (const interceptor of this.interceptors) {
          const [interceptorError, interceptedData] = await safeRun(async () =>
            await interceptor(operation, processedData)
          );

          if (interceptorError) {
            return Result.fail(new Error(`Interceptor failed: ${interceptorError.message}`));
          }

          if (interceptedData !== undefined) {
            processedData = interceptedData;
          }
        }

        // Execute service operation
        const service = this.services.get(serviceName);
        if (!service) {
          return Result.fail(new Error(`Service ${serviceName} not found`));
        }

        const [serviceError, serviceResult] = await safeRun(async () =>
          await service[operation](processedData)
        );

        if (serviceError) {
          return Result.fail(serviceError);
        }

        return Result.ok(serviceResult);

      } catch (error) {
        return Result.fail(new Error(`System integration error: ${(error as Error).message}`));
      }
    }
  }
}
```

## Implementation Strategies

### 1. Layered Error Handling

- Service layer handles business logic errors
- Repository layer handles data persistence errors
- Integration layer handles external system errors
- Each layer provides appropriate context and recovery options

### 2. Asynchronous Operation Management

- Use Result patterns for async operations
- Implement proper timeout and retry mechanisms
- Handle concurrent operations with controlled parallelism
- Provide progress tracking for long-running operations

### 3. Batch Processing Architecture

- Process data in manageable batches
- Implement recovery mechanisms for partial failures
- Provide comprehensive progress reporting
- Use controlled concurrency to avoid system overload

### 4. System Integration Patterns

- Use interceptor patterns for cross-cutting concerns
- Implement service registration and discovery
- Provide consistent error handling across integrations
- Enable monitoring and observability

## Key Benefits

- **Scalable Architecture**: Handles enterprise-scale operations efficiently
- **Robust Error Handling**: Comprehensive error management with recovery
  options
- **Monitoring Integration**: Built-in logging and progress tracking
- **System Resilience**: Graceful degradation and recovery mechanisms
- **Performance Optimization**: Batched and concurrent processing capabilities

## Best Practices

- **Separate Concerns**: Keep validation, business logic, and persistence
  separate
- **Implement Circuit Breakers**: Protect against cascading failures
- **Use Bulk Operations**: Process multiple items efficiently
- **Provide Progress Feedback**: Keep users informed during long operations
- **Log Comprehensively**: Enable debugging and monitoring
- **Plan for Recovery**: Implement fallback mechanisms

## Common Integration Patterns

- Service layer integration with Result patterns
- Batch processing with error aggregation
- Async workflow orchestration
- Cross-cutting concern implementation
- System monitoring and observability

## Related Examples

- [Advanced Result Patterns](./example-1.md)
- [Async Result Patterns](./example-2.md)
- [Error Aggregation Patterns](./example-3.md)
- [Performance-Optimized Utilities](../advanced/example-3.md)
