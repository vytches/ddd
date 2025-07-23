# Async Result Patterns

**Version**: 1.0.0 **Package**: @vytches-ddd/utils **Complexity**: intermediate
**Domain**: Infrastructure **Patterns**: Asynchronous operations, Promise
integration, concurrent processing **Dependencies**: @vytches-ddd/utils

## Description

Advanced asynchronous Result patterns for handling Promise-based operations,
concurrent processing, and complex async workflows. This example demonstrates
how to maintain Result pattern benefits in asynchronous contexts while managing
concurrency and error handling.

## Business Context

Modern applications heavily rely on asynchronous operations:

- API calls to external services
- Database operations
- File I/O operations
- Concurrent processing of multiple items
- Sequential async operations with dependencies

Async Result patterns ensure that asynchronous operations maintain the same
level of error safety and composability as synchronous operations.

## Code Example

```typescript
// async-result-patterns.ts
import { Result, LibUtils } from '@vytches-ddd/utils';
import {
  UserData,
  ApiResponse,
  AsyncResult,
  ResultAggregator,
  ServiceResponse,
} from '../types';

// ✅ FOCUS: Async Result pattern operations
export class AsyncResultPatterns {
  // 1. Basic Async Result Operations
  async fetchUserById(userId: string): Promise<Result<UserData, Error>> {
    return await Result.tryAsync(async () => {
      // Simulate API call
      await LibUtils.sleep(100);

      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required');
      }

      if (userId === 'not-found') {
        throw new Error('User not found');
      }

      if (userId === 'server-error') {
        throw new Error('Internal server error');
      }

      return {
        id: userId,
        email: `user-${userId}@example.com`,
        name: `User ${userId}`,
        role: 'user',
        createdAt: new Date(),
      };
    });
  }

  // 2. Chaining Async Operations
  async getUserWithProfile(userId: string): Promise<Result<any, Error>> {
    const userResult = await this.fetchUserById(userId);

    if (userResult.isFailure) {
      return Result.fail(userResult.error);
    }

    // Chain async operations using flatMapAsync
    return await userResult.flatMapAsync(async user => {
      const profileResult = await this.fetchUserProfile(user.id);

      if (profileResult.isFailure) {
        return Result.fail(profileResult.error);
      }

      return Result.ok({
        user,
        profile: profileResult.value,
        lastUpdated: new Date(),
      });
    });
  }

  private async fetchUserProfile(userId: string): Promise<Result<any, Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(50);

      if (userId === 'no-profile') {
        throw new Error('Profile not found');
      }

      return {
        bio: `Bio for user ${userId}`,
        preferences: { theme: 'light', notifications: true },
        lastLogin: new Date(),
      };
    });
  }

  // 3. Sequential Async Processing
  async processUserSequentially(
    userIds: string[]
  ): Promise<Result<UserData[], Error>> {
    const processedUsers: UserData[] = [];

    for (const userId of userIds) {
      const userResult = await this.fetchUserById(userId);

      if (userResult.isFailure) {
        return Result.fail(
          new Error(
            `Failed to process user ${userId}: ${userResult.error.message}`
          )
        );
      }

      processedUsers.push(userResult.value);
    }

    return Result.ok(processedUsers);
  }

  // 4. Concurrent Async Processing with Error Handling
  async processUsersConcurrently(
    userIds: string[]
  ): Promise<Result<UserData[], Error[]>> {
    const userPromises = userIds.map(async userId => {
      const result = await this.fetchUserById(userId);
      return { userId, result };
    });

    const results = await Promise.all(userPromises);

    const successfulUsers: UserData[] = [];
    const errors: Error[] = [];

    results.forEach(({ userId, result }) => {
      if (result.isSuccess) {
        successfulUsers.push(result.value);
      } else {
        errors.push(new Error(`User ${userId}: ${result.error.message}`));
      }
    });

    if (errors.length > 0) {
      return Result.fail(errors);
    }

    return Result.ok(successfulUsers);
  }

  // 5. Batch Processing with Partial Success
  async processBatch(
    userIds: string[],
    batchSize: number = 3
  ): Promise<ResultAggregator<UserData>> {
    const aggregator: ResultAggregator<UserData> = {
      results: [],
      successCount: 0,
      failureCount: 0,
      totalCount: userIds.length,
      getSuccessful: function () {
        return this.results.filter(r => r.isSuccess).map(r => r.value!);
      },
      getFailures: function () {
        return this.results.filter(r => !r.isSuccess).map(r => r.error!);
      },
      hasAllSucceeded: function () {
        return this.failureCount === 0;
      },
      hasAnyFailed: function () {
        return this.failureCount > 0;
      },
    };

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async userId => {
        const result = await this.fetchUserById(userId);

        const asyncResult: AsyncResult<UserData> = {
          value: result.isSuccess ? result.value : undefined,
          error: result.isFailure ? result.error : undefined,
          isSuccess: result.isSuccess,
          timestamp: new Date(),
          metadata: { userId, batchIndex: Math.floor(i / batchSize) },
        };

        return asyncResult;
      });

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(result => {
        aggregator.results.push(result);
        if (result.isSuccess) {
          aggregator.successCount++;
        } else {
          aggregator.failureCount++;
        }
      });

      // Add delay between batches to be kind to external services
      if (i + batchSize < userIds.length) {
        await LibUtils.sleep(100);
      }
    }

    return aggregator;
  }

  // 6. Async Operation with Timeout and Retry
  async fetchUserWithRetry(
    userId: string,
    maxRetries: number = 3,
    timeoutMs: number = 5000
  ): Promise<Result<UserData, Error>> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.fetchWithTimeout(userId, timeoutMs);

      if (result.isSuccess) {
        return result;
      }

      lastError = result.error;

      // Don't retry on certain types of errors
      if (result.error.message.includes('not found')) {
        break;
      }

      // Exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await LibUtils.sleep(delay);
      }
    }

    return Result.fail(
      new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`)
    );
  }

  private async fetchWithTimeout(
    userId: string,
    timeoutMs: number
  ): Promise<Result<UserData, Error>> {
    return await Result.tryAsync(async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      });

      const fetchPromise = this.fetchUserById(userId);

      const result = await Promise.race([fetchPromise, timeoutPromise]);

      if (result.isFailure) {
        throw result.error;
      }

      return result.value;
    });
  }

  // 7. Complex Async Workflow with Dependencies
  async setupUserAccount(
    userData: Partial<UserData>
  ): Promise<Result<any, Error>> {
    // Step 1: Validate and create user
    const createResult = await this.createUserAsync(userData);
    if (createResult.isFailure) {
      return Result.fail(createResult.error);
    }

    const user = createResult.value;

    // Step 2: Create user profile (depends on user creation)
    const profileResult = await this.createUserProfileAsync(user.id);
    if (profileResult.isFailure) {
      // Cleanup: delete the created user
      await this.deleteUserAsync(user.id);
      return Result.fail(
        new Error(`Profile creation failed: ${profileResult.error.message}`)
      );
    }

    // Step 3: Set up user permissions (depends on both user and profile)
    const permissionsResult = await this.setupUserPermissionsAsync(
      user.id,
      user.role
    );
    if (permissionsResult.isFailure) {
      // Cleanup: delete profile and user
      await this.deleteUserProfileAsync(user.id);
      await this.deleteUserAsync(user.id);
      return Result.fail(
        new Error(
          `Permissions setup failed: ${permissionsResult.error.message}`
        )
      );
    }

    // Step 4: Send welcome notification (non-critical, can fail)
    const notificationResult = await this.sendWelcomeNotificationAsync(user.id);

    return Result.ok({
      user,
      profile: profileResult.value,
      permissions: permissionsResult.value,
      notificationSent: notificationResult.isSuccess,
      setupCompletedAt: new Date(),
    });
  }

  private async createUserAsync(
    userData: Partial<UserData>
  ): Promise<Result<UserData, Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(200); // Simulate database operation

      if (!userData.email || !userData.name) {
        throw new Error('Email and name are required');
      }

      return {
        id: LibUtils.getUUID(),
        email: userData.email,
        name: userData.name,
        role: userData.role || 'user',
        createdAt: new Date(),
      };
    });
  }

  private async createUserProfileAsync(
    userId: string
  ): Promise<Result<any, Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(150);

      if (userId === 'profile-fail') {
        throw new Error('Profile creation failed');
      }

      return {
        userId,
        bio: '',
        preferences: { theme: 'light' },
        createdAt: new Date(),
      };
    });
  }

  private async setupUserPermissionsAsync(
    userId: string,
    role: string
  ): Promise<Result<string[], Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(100);

      const permissions =
        role === 'admin'
          ? ['read', 'write', 'delete', 'admin']
          : ['read', 'write'];

      return permissions;
    });
  }

  private async sendWelcomeNotificationAsync(
    userId: string
  ): Promise<Result<boolean, Error>> {
    return await Result.tryAsync(async () => {
      await LibUtils.sleep(50);

      // Simulate notification service that might be down
      if (Math.random() < 0.1) {
        throw new Error('Notification service unavailable');
      }

      return true;
    });
  }

  private async deleteUserAsync(userId: string): Promise<void> {
    await LibUtils.sleep(50);
    console.log(`User ${userId} deleted (cleanup)`);
  }

  private async deleteUserProfileAsync(userId: string): Promise<void> {
    await LibUtils.sleep(30);
    console.log(`Profile for ${userId} deleted (cleanup)`);
  }

  // 8. Async Result Aggregation with Progress Tracking
  async processUsersWithProgress(
    userIds: string[],
    onProgress?: (completed: number, total: number, current?: string) => void
  ): Promise<Result<UserData[], Error[]>> {
    const results: UserData[] = [];
    const errors: Error[] = [];
    let completed = 0;

    for (const userId of userIds) {
      onProgress?.(completed, userIds.length, userId);

      const result = await this.fetchUserById(userId);

      if (result.isSuccess) {
        results.push(result.value);
      } else {
        errors.push(new Error(`User ${userId}: ${result.error.message}`));
      }

      completed++;
    }

    onProgress?.(completed, userIds.length);

    if (errors.length > 0) {
      return Result.fail(errors);
    }

    return Result.ok(results);
  }
}
```

## Key Features

- **Async Result Operations**: `tryAsync`, `mapAsync`, `flatMapAsync` for
  Promise handling
- **Sequential Processing**: Process items one by one with early termination on
  errors
- **Concurrent Processing**: Handle multiple operations in parallel with error
  collection
- **Batch Processing**: Process large datasets in manageable chunks
- **Retry Logic**: Robust retry mechanisms with exponential backoff
- **Timeout Handling**: Prevent hanging operations with timeout support
- **Complex Workflows**: Multi-step async operations with cleanup on failure
- **Progress Tracking**: Monitor progress of long-running async operations

## Usage Examples

```typescript
const processor = new AsyncResultPatterns();

// Basic async operation
const userResult = await processor.fetchUserById('123');
if (userResult.isSuccess) {
  console.log('User:', userResult.value);
}

// Sequential processing
const userIds = ['1', '2', '3'];
const sequentialResult = await processor.processUserSequentially(userIds);

// Concurrent processing
const concurrentResult = await processor.processUsersConcurrently(userIds);

// Batch processing with progress
const batchResult = await processor.processBatch(userIds, 2);
console.log(`Processed: ${batchResult.successCount}/${batchResult.totalCount}`);

// Complex workflow
const accountResult = await processor.setupUserAccount({
  email: 'new@example.com',
  name: 'New User',
  role: 'user',
});

// Progress tracking
await processor.processUsersWithProgress(
  userIds,
  (completed, total, current) => {
    console.log(
      `Progress: ${completed}/${total} (currently processing: ${current})`
    );
  }
);
```

## Common Pitfalls

- **Unhandled Promise rejections**: Always use Result.tryAsync for Promise
  operations
- **Sequential instead of concurrent**: Use Promise.all when operations can run
  in parallel
- **Memory issues with large batches**: Process in smaller batches for large
  datasets
- **Infinite retries**: Always set maximum retry limits and backoff strategies
- **Missing cleanup**: Handle cleanup in complex workflows when operations fail

## Related Examples

- [Result Pattern Fundamentals](../basic/example-1.md)
- [Advanced Result Patterns](./example-1.md)
- [Performance-Optimized Utilities](../advanced/example-3.md)
