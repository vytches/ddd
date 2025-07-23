# Common Logging Use Cases

**Version**: 1.0.0 **Package**: @vytches-ddd/logging **Complexity**: basic
**Domain**: Practical Applications **Patterns**: Real-world scenarios, problem
solving **Dependencies**: @vytches-ddd/logging

## Overview

This guide presents common logging scenarios and practical applications found in
real-world applications. Each use case demonstrates specific logging patterns,
challenges, and solutions that development teams encounter when implementing
structured logging.

## Use Case 1: User Authentication Logging

### Scenario

Track user authentication events for security auditing, troubleshooting login
issues, and monitoring suspicious activity.

### Implementation

```typescript
// auth.service.ts
import { Logger } from '@vytches-ddd/logging';
import { UserData, LoginRequest, AuthResult } from './types';

export class AuthenticationService {
  private logger = Logger.forContext();

  async authenticateUser(loginRequest: LoginRequest): Promise<AuthResult> {
    const authLogger = this.logger.withContext({
      operation: 'userAuthentication',
      username: loginRequest.username,
      ipAddress: loginRequest.ipAddress,
      userAgent: loginRequest.userAgent,
    });

    // ⭐ FOCUS: Log authentication attempt
    authLogger.info('User authentication attempt', {
      username: loginRequest.username,
      loginMethod: loginRequest.method || 'password',
      ipAddress: loginRequest.ipAddress,
      timestamp: new Date(),
    });

    try {
      // Validate credentials
      const user = await this.validateCredentials(loginRequest);

      if (!user) {
        // ⭐ FOCUS: Log authentication failure
        authLogger.warn('Authentication failed - invalid credentials', {
          username: loginRequest.username,
          reason: 'invalid_credentials',
          ipAddress: loginRequest.ipAddress,
        });

        // Track failed attempts for security monitoring
        await this.trackFailedLogin(
          loginRequest.username,
          loginRequest.ipAddress
        );

        return { success: false, error: 'Invalid credentials' };
      }

      if (!user.isActive) {
        // ⭐ FOCUS: Log blocked account access
        authLogger.warn('Authentication failed - account inactive', {
          userId: user.id,
          username: loginRequest.username,
          reason: 'account_inactive',
        });

        return { success: false, error: 'Account is inactive' };
      }

      // Generate session token
      const token = await this.generateAuthToken(user);

      // ⭐ FOCUS: Log successful authentication
      authLogger.info('User authenticated successfully', {
        userId: user.id,
        username: user.username,
        role: user.role,
        sessionId: token.sessionId,
        expiresAt: token.expiresAt,
      });

      // Update last login
      await this.updateLastLogin(user.id, loginRequest.ipAddress);

      return {
        success: true,
        user: user,
        token: token.value,
        expiresAt: token.expiresAt,
      };
    } catch (error) {
      // ⭐ FOCUS: Log authentication system errors
      authLogger.error('Authentication system error', {
        username: loginRequest.username,
        error: error,
        ipAddress: loginRequest.ipAddress,
      });

      return { success: false, error: 'Authentication system unavailable' };
    }
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    const logoutLogger = this.logger.withContext({
      operation: 'userLogout',
      userId,
      sessionId,
    });

    // ⭐ FOCUS: Log logout event
    logoutLogger.info('User logout initiated', {
      userId,
      sessionId,
      timestamp: new Date(),
    });

    try {
      await this.invalidateSession(sessionId);

      logoutLogger.info('User logout completed', {
        userId,
        sessionId,
      });
    } catch (error) {
      logoutLogger.error('Logout failed', {
        userId,
        sessionId,
        error: error,
      });
      throw error;
    }
  }

  // Helper methods...
  private async validateCredentials(
    request: LoginRequest
  ): Promise<UserData | null> {
    // Mock validation
    return {
      id: 'user-123',
      username: request.username,
      email: `${request.username}@example.com`,
      role: 'user',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
    };
  }

  private async trackFailedLogin(
    username: string,
    ipAddress: string
  ): Promise<void> {
    this.logger.warn('Failed login tracked', {
      username,
      ipAddress,
      tracked: true,
    });
  }

  private async generateAuthToken(user: UserData): Promise<any> {
    return {
      value: 'token-' + Date.now(),
      sessionId: 'session-' + Date.now(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };
  }

  private async updateLastLogin(
    userId: string,
    ipAddress: string
  ): Promise<void> {
    this.logger.debug('Last login updated', { userId, ipAddress });
  }

  private async invalidateSession(sessionId: string): Promise<void> {
    this.logger.debug('Session invalidated', { sessionId });
  }
}
```

## Use Case 2: E-commerce Order Processing

### Scenario

Track order processing workflow from creation through fulfillment, including
payment processing, inventory management, and shipping.

### Implementation

```typescript
// order-processing.service.ts
import { Logger } from '@vytches-ddd/logging';
import { OrderData, OrderItem, PaymentInfo, ShippingInfo } from './types';

export class OrderProcessingService {
  private logger = Logger.forContext();

  async processOrder(orderData: OrderData): Promise<OrderData> {
    const orderLogger = this.logger.withContext({
      operation: 'orderProcessing',
      orderId: orderData.id,
      customerId: orderData.customerId,
    });

    // ⭐ FOCUS: Log order processing start
    orderLogger.info('Order processing started', {
      orderId: orderData.id,
      customerId: orderData.customerId,
      itemCount: orderData.items.length,
      totalAmount: orderData.totalAmount,
      paymentMethod: orderData.paymentInfo?.method,
    });

    try {
      // Phase 1: Order Validation
      await this.validateOrder(orderData, orderLogger);

      // Phase 2: Inventory Check
      await this.checkInventory(orderData.items, orderLogger);

      // Phase 3: Payment Processing
      await this.processPayment(orderData.paymentInfo!, orderLogger);

      // Phase 4: Reserve Inventory
      await this.reserveInventory(orderData.items, orderLogger);

      // Phase 5: Create Shipment
      const shipmentInfo = await this.createShipment(orderData, orderLogger);

      // Phase 6: Update Order Status
      const processedOrder = {
        ...orderData,
        status: 'processing' as const,
        processedAt: new Date(),
        shipmentInfo: shipmentInfo,
      };

      // ⭐ FOCUS: Log order processing completion
      orderLogger.info('Order processing completed successfully', {
        orderId: processedOrder.id,
        status: processedOrder.status,
        shipmentId: shipmentInfo.shipmentId,
        estimatedDelivery: shipmentInfo.estimatedDelivery,
        processingTime: Date.now() - orderData.createdAt.getTime(),
      });

      return processedOrder;
    } catch (error) {
      // ⭐ FOCUS: Log order processing failure
      orderLogger.error('Order processing failed', {
        orderId: orderData.id,
        error: error,
        currentStatus: orderData.status,
        phase: this.determineFailurePhase(error),
      });

      // Update order status to failed
      const failedOrder = {
        ...orderData,
        status: 'failed' as const,
        failureReason: error.message,
        failedAt: new Date(),
      };

      return failedOrder;
    }
  }

  private async validateOrder(
    orderData: OrderData,
    logger: Logger
  ): Promise<void> {
    logger.debug('Validating order', { phase: 'validation' });

    if (orderData.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (orderData.totalAmount <= 0) {
      throw new Error('Order total must be greater than zero');
    }

    logger.debug('Order validation passed', {
      phase: 'validation',
      itemCount: orderData.items.length,
      totalAmount: orderData.totalAmount,
    });
  }

  private async checkInventory(
    items: OrderItem[],
    logger: Logger
  ): Promise<void> {
    logger.debug('Checking inventory availability', {
      phase: 'inventory_check',
      itemCount: items.length,
    });

    const unavailableItems: string[] = [];

    for (const item of items) {
      const available = await this.isItemAvailable(
        item.productId,
        item.quantity
      );

      if (!available) {
        unavailableItems.push(item.productId);
        logger.warn('Item not available', {
          productId: item.productId,
          requestedQuantity: item.quantity,
          phase: 'inventory_check',
        });
      }
    }

    if (unavailableItems.length > 0) {
      throw new Error(`Items not available: ${unavailableItems.join(', ')}`);
    }

    logger.info('Inventory check passed', {
      phase: 'inventory_check',
      availableItems: items.length,
    });
  }

  private async processPayment(
    paymentInfo: PaymentInfo,
    logger: Logger
  ): Promise<void> {
    logger.info('Processing payment', {
      phase: 'payment',
      method: paymentInfo.method,
      amount: paymentInfo.amount,
      // cardNumber automatically masked
      lastFourDigits: paymentInfo.cardNumber?.slice(-4),
    });

    try {
      // Simulate payment processing
      const paymentResult = await this.chargePayment(paymentInfo);

      logger.info('Payment processed successfully', {
        phase: 'payment',
        transactionId: paymentResult.transactionId,
        amount: paymentResult.amount,
        status: paymentResult.status,
      });
    } catch (error) {
      logger.error('Payment processing failed', {
        phase: 'payment',
        method: paymentInfo.method,
        amount: paymentInfo.amount,
        error: error,
      });
      throw error;
    }
  }

  private async reserveInventory(
    items: OrderItem[],
    logger: Logger
  ): Promise<void> {
    logger.debug('Reserving inventory', {
      phase: 'inventory_reservation',
      itemCount: items.length,
    });

    for (const item of items) {
      await this.reserveItem(item.productId, item.quantity);

      logger.debug('Item reserved', {
        productId: item.productId,
        quantity: item.quantity,
        phase: 'inventory_reservation',
      });
    }

    logger.info('Inventory reservation completed', {
      phase: 'inventory_reservation',
      totalItems: items.length,
    });
  }

  private async createShipment(
    orderData: OrderData,
    logger: Logger
  ): Promise<ShippingInfo> {
    logger.info('Creating shipment', {
      phase: 'shipment',
      orderId: orderData.id,
      itemCount: orderData.items.length,
    });

    const shipmentInfo: ShippingInfo = {
      shipmentId: 'SHIP-' + Date.now(),
      carrier: 'UPS',
      trackingNumber: 'TRK-' + Date.now(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      shippingAddress: orderData.shippingAddress,
    };

    logger.info('Shipment created successfully', {
      phase: 'shipment',
      shipmentId: shipmentInfo.shipmentId,
      trackingNumber: shipmentInfo.trackingNumber,
      carrier: shipmentInfo.carrier,
      estimatedDelivery: shipmentInfo.estimatedDelivery,
    });

    return shipmentInfo;
  }

  // Helper methods
  private async isItemAvailable(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    return Math.random() > 0.1; // 90% availability rate
  }

  private async chargePayment(paymentInfo: PaymentInfo): Promise<any> {
    if (Math.random() > 0.95) {
      // 5% failure rate
      throw new Error('Payment declined by bank');
    }

    return {
      transactionId: 'TXN-' + Date.now(),
      amount: paymentInfo.amount,
      status: 'completed',
    };
  }

  private async reserveItem(
    productId: string,
    quantity: number
  ): Promise<void> {
    // Mock inventory reservation
  }

  private determineFailurePhase(error: Error): string {
    if (error.message.includes('item')) return 'validation';
    if (error.message.includes('available')) return 'inventory_check';
    if (error.message.includes('Payment')) return 'payment';
    if (error.message.includes('reserve')) return 'inventory_reservation';
    if (error.message.includes('shipment')) return 'shipment';
    return 'unknown';
  }
}
```

## Use Case 3: API Rate Limiting and Monitoring

### Scenario

Monitor API usage, track rate limits, and log suspicious activity patterns for
security and performance analysis.

### Implementation

```typescript
// api-monitoring.service.ts
import { Logger } from '@vytches-ddd/logging';
import { ApiRequest, RateLimitInfo, ApiMetrics } from './types';

export class ApiMonitoringService {
  private logger = Logger.forContext();
  private requestCounts = new Map<string, number>();
  private suspiciousActivity = new Map<string, number>();

  logApiRequest(request: ApiRequest): void {
    const apiLogger = this.logger.withContext({
      operation: 'apiRequest',
      endpoint: request.endpoint,
      method: request.method,
      clientId: request.clientId,
      requestId: request.requestId,
    });

    // ⭐ FOCUS: Log incoming API request
    apiLogger.info('API request received', {
      endpoint: request.endpoint,
      method: request.method,
      clientId: request.clientId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      requestSize: request.bodySize || 0,
      timestamp: new Date(),
    });

    // Track request counts
    const key = `${request.clientId}:${request.endpoint}`;
    const currentCount = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, currentCount + 1);
  }

  logApiResponse(
    request: ApiRequest,
    responseTime: number,
    statusCode: number,
    responseSize: number
  ): void {
    const apiLogger = this.logger.withContext({
      operation: 'apiResponse',
      endpoint: request.endpoint,
      requestId: request.requestId,
    });

    const performanceCategory = this.categorizePerformance(responseTime);
    const isError = statusCode >= 400;
    const isServerError = statusCode >= 500;

    // ⭐ FOCUS: Log API response with metrics
    apiLogger.info('API request completed', {
      endpoint: request.endpoint,
      method: request.method,
      clientId: request.clientId,
      statusCode: statusCode,
      responseTime: responseTime,
      responseSize: responseSize,
      performance: performanceCategory,
      isError: isError,
      isServerError: isServerError,
      timestamp: new Date(),
    });

    // Log performance warnings
    if (responseTime > 5000) {
      // Slow response
      apiLogger.warn('Slow API response detected', {
        endpoint: request.endpoint,
        responseTime: responseTime,
        threshold: 5000,
        clientId: request.clientId,
      });
    }

    // Log error responses
    if (isError) {
      const errorLevel = isServerError ? 'error' : 'warn';
      apiLogger[errorLevel]('API error response', {
        endpoint: request.endpoint,
        statusCode: statusCode,
        clientId: request.clientId,
        errorCategory: this.categorizeError(statusCode),
      });
    }
  }

  checkRateLimit(clientId: string, endpoint: string): RateLimitInfo {
    const rateLimitLogger = this.logger.withContext({
      operation: 'rateLimitCheck',
      clientId,
      endpoint,
    });

    const key = `${clientId}:${endpoint}`;
    const requestCount = this.requestCounts.get(key) || 0;
    const limit = this.getRateLimit(clientId, endpoint);
    const remaining = Math.max(0, limit - requestCount);
    const isExceeded = requestCount >= limit;

    const rateLimitInfo: RateLimitInfo = {
      clientId,
      endpoint,
      limit,
      remaining,
      isExceeded,
      resetTime: new Date(Date.now() + 3600000), // 1 hour
    };

    if (isExceeded) {
      // ⭐ FOCUS: Log rate limit exceeded
      rateLimitLogger.warn('Rate limit exceeded', {
        clientId,
        endpoint,
        currentRequests: requestCount,
        limit: limit,
        exceedBy: requestCount - limit,
      });

      // Track suspicious activity
      this.trackSuspiciousActivity(clientId, endpoint);
    } else if (remaining <= limit * 0.1) {
      // 90% of limit used
      // ⭐ FOCUS: Log approaching rate limit
      rateLimitLogger.info('Rate limit approaching', {
        clientId,
        endpoint,
        currentRequests: requestCount,
        limit: limit,
        remaining: remaining,
        percentageUsed: Math.round((requestCount / limit) * 100),
      });
    }

    return rateLimitInfo;
  }

  private trackSuspiciousActivity(clientId: string, endpoint: string): void {
    const key = `${clientId}:suspicious`;
    const count = this.suspiciousActivity.get(key) || 0;
    this.suspiciousActivity.set(key, count + 1);

    if (count + 1 >= 5) {
      // 5 rate limit violations
      // ⭐ FOCUS: Log potential abuse
      this.logger.error('Potential API abuse detected', {
        clientId,
        endpoint,
        violationCount: count + 1,
        severity: 'high',
        action: 'manual_review_required',
      });
    }
  }

  generateApiMetrics(timeWindow: number): ApiMetrics {
    const metricsLogger = this.logger.withContext({
      operation: 'metricsGeneration',
      timeWindow,
    });

    // Calculate metrics from tracked data
    const totalRequests = Array.from(this.requestCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const uniqueClients = new Set(
      Array.from(this.requestCounts.keys()).map(key => key.split(':')[0])
    ).size;

    const topEndpoints = this.getTopEndpoints(10);
    const topClients = this.getTopClients(10);

    const metrics: ApiMetrics = {
      timeWindow,
      totalRequests,
      uniqueClients,
      requestsPerMinute: totalRequests / (timeWindow / 60),
      topEndpoints,
      topClients,
      generatedAt: new Date(),
    };

    // ⭐ FOCUS: Log API metrics
    metricsLogger.info('API metrics generated', {
      totalRequests,
      uniqueClients,
      requestsPerMinute: metrics.requestsPerMinute,
      topEndpoints: topEndpoints.slice(0, 5), // Top 5 for logging
      timeWindow,
    });

    return metrics;
  }

  private categorizePerformance(responseTimeMs: number): string {
    if (responseTimeMs < 100) return 'excellent';
    if (responseTimeMs < 500) return 'good';
    if (responseTimeMs < 2000) return 'acceptable';
    if (responseTimeMs < 5000) return 'slow';
    return 'critical';
  }

  private categorizeError(statusCode: number): string {
    if (statusCode === 400) return 'bad_request';
    if (statusCode === 401) return 'unauthorized';
    if (statusCode === 403) return 'forbidden';
    if (statusCode === 404) return 'not_found';
    if (statusCode === 429) return 'rate_limited';
    if (statusCode >= 500) return 'server_error';
    return 'client_error';
  }

  private getRateLimit(clientId: string, endpoint: string): number {
    // Mock rate limits - could be from configuration
    if (endpoint.includes('/admin/')) return 100;
    if (endpoint.includes('/api/v1/')) return 1000;
    return 500;
  }

  private getTopEndpoints(
    count: number
  ): Array<{ endpoint: string; requests: number }> {
    const endpointCounts = new Map<string, number>();

    for (const [key, requests] of this.requestCounts) {
      const endpoint = key.split(':')[1];
      const current = endpointCounts.get(endpoint) || 0;
      endpointCounts.set(endpoint, current + requests);
    }

    return Array.from(endpointCounts.entries())
      .map(([endpoint, requests]) => ({ endpoint, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, count);
  }

  private getTopClients(
    count: number
  ): Array<{ clientId: string; requests: number }> {
    const clientCounts = new Map<string, number>();

    for (const [key, requests] of this.requestCounts) {
      const clientId = key.split(':')[0];
      const current = clientCounts.get(clientId) || 0;
      clientCounts.set(clientId, current + requests);
    }

    return Array.from(clientCounts.entries())
      .map(([clientId, requests]) => ({ clientId, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, count);
  }
}
```

## Use Case 4: Background Job Processing

### Scenario

Monitor background job execution, track processing times, handle failures, and
ensure jobs complete successfully.

### Implementation

```typescript
// job-processor.service.ts
import { Logger } from '@vytches-ddd/logging';
import { Job, JobResult, JobStatus } from './types';

export class JobProcessorService {
  private logger = Logger.forContext();
  private activeJobs = new Map<string, Date>();

  async processJob(job: Job): Promise<JobResult> {
    const jobLogger = this.logger.withContext({
      operation: 'jobProcessing',
      jobId: job.id,
      jobType: job.type,
      priority: job.priority,
    });

    // ⭐ FOCUS: Log job processing start
    jobLogger.info('Job processing started', {
      jobId: job.id,
      jobType: job.type,
      priority: job.priority,
      scheduledAt: job.scheduledAt,
      attempts: job.attempts || 0,
      maxRetries: job.maxRetries || 3,
      payload: this.sanitizeJobPayload(job.payload),
    });

    const startTime = Date.now();
    this.activeJobs.set(job.id, new Date());

    try {
      // Process job based on type
      const result = await this.executeJobByType(job);
      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Log successful job completion
      jobLogger.info('Job completed successfully', {
        jobId: job.id,
        duration,
        result: this.sanitizeJobResult(result),
        performanceCategory: this.categorizePerformance(duration),
        memoryUsage: this.getMemoryUsage(),
      });

      this.activeJobs.delete(job.id);

      return {
        jobId: job.id,
        status: 'completed',
        result: result,
        duration: duration,
        completedAt: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isRetryable = this.isRetryableError(error);
      const shouldRetry =
        (job.attempts || 0) < (job.maxRetries || 3) && isRetryable;

      // ⭐ FOCUS: Log job failure
      jobLogger.error('Job processing failed', {
        jobId: job.id,
        error: error,
        duration,
        attempts: job.attempts || 0,
        maxRetries: job.maxRetries || 3,
        isRetryable,
        shouldRetry,
        errorCategory: this.categorizeError(error),
      });

      this.activeJobs.delete(job.id);

      if (shouldRetry) {
        // ⭐ FOCUS: Log job retry scheduling
        jobLogger.warn('Job scheduled for retry', {
          jobId: job.id,
          nextAttempt: job.attempts ? job.attempts + 1 : 1,
          retryDelay: this.calculateRetryDelay(job.attempts || 0),
        });

        return {
          jobId: job.id,
          status: 'retry_scheduled',
          error: error.message,
          duration: duration,
          nextRetryAt: new Date(
            Date.now() + this.calculateRetryDelay(job.attempts || 0)
          ),
        };
      } else {
        // ⭐ FOCUS: Log job permanent failure
        jobLogger.error('Job failed permanently', {
          jobId: job.id,
          finalAttempt: (job.attempts || 0) + 1,
          totalDuration: duration,
          reason: 'max_retries_exceeded',
        });

        return {
          jobId: job.id,
          status: 'failed',
          error: error.message,
          duration: duration,
          failedAt: new Date(),
        };
      }
    }
  }

  async processJobBatch(jobs: Job[]): Promise<JobResult[]> {
    const batchLogger = this.logger.withContext({
      operation: 'batchJobProcessing',
      batchSize: jobs.length,
    });

    // ⭐ FOCUS: Log batch processing start
    batchLogger.info('Batch job processing started', {
      totalJobs: jobs.length,
      jobTypes: this.getJobTypeDistribution(jobs),
      priorityDistribution: this.getPriorityDistribution(jobs),
      timestamp: new Date(),
    });

    const results: JobResult[] = [];
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    let retryCount = 0;

    // Process jobs with concurrency control
    const concurrencyLimit = 5;
    for (let i = 0; i < jobs.length; i += concurrencyLimit) {
      const batch = jobs.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.allSettled(
        batch.map(job => this.processJob(job))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const jobResult = result.value;
          results.push(jobResult);

          switch (jobResult.status) {
            case 'completed':
              successCount++;
              break;
            case 'retry_scheduled':
              retryCount++;
              break;
            case 'failed':
              failureCount++;
              break;
          }
        } else {
          // Handle unexpected batch failures
          const job = batch[index];
          batchLogger.error('Job batch processing error', {
            jobId: job.id,
            error: result.reason,
          });

          failureCount++;
          results.push({
            jobId: job.id,
            status: 'failed',
            error: 'Batch processing error',
            duration: 0,
            failedAt: new Date(),
          });
        }
      });
    }

    const totalDuration = Date.now() - startTime;

    // ⭐ FOCUS: Log batch completion summary
    batchLogger.info('Batch job processing completed', {
      totalJobs: jobs.length,
      successCount,
      failureCount,
      retryCount,
      successRate: Math.round((successCount / jobs.length) * 100),
      totalDuration,
      averageDuration: Math.round(totalDuration / jobs.length),
      throughput: Math.round((jobs.length / totalDuration) * 1000), // jobs per second
    });

    return results;
  }

  getActiveJobsStatus(): any {
    const statusLogger = this.logger.withContext({
      operation: 'activeJobsStatus',
    });

    const activeJobsInfo = Array.from(this.activeJobs.entries()).map(
      ([jobId, startTime]) => ({
        jobId,
        duration: Date.now() - startTime.getTime(),
        startedAt: startTime,
      })
    );

    const longRunningJobs = activeJobsInfo.filter(job => job.duration > 300000); // 5 minutes

    if (longRunningJobs.length > 0) {
      // ⭐ FOCUS: Log long-running jobs warning
      statusLogger.warn('Long-running jobs detected', {
        activeJobs: this.activeJobs.size,
        longRunningJobs: longRunningJobs.length,
        longRunningJobIds: longRunningJobs.map(job => job.jobId),
        maxDuration: Math.max(...longRunningJobs.map(job => job.duration)),
      });
    }

    statusLogger.info('Active jobs status', {
      activeJobs: this.activeJobs.size,
      longRunningJobs: longRunningJobs.length,
      averageDuration:
        activeJobsInfo.length > 0
          ? Math.round(
              activeJobsInfo.reduce((sum, job) => sum + job.duration, 0) /
                activeJobsInfo.length
            )
          : 0,
    });

    return {
      activeJobs: this.activeJobs.size,
      activeJobDetails: activeJobsInfo,
      longRunningJobs: longRunningJobs,
    };
  }

  private async executeJobByType(job: Job): Promise<any> {
    switch (job.type) {
      case 'email_notification':
        return await this.processEmailNotification(job.payload);
      case 'data_export':
        return await this.processDataExport(job.payload);
      case 'report_generation':
        return await this.processReportGeneration(job.payload);
      case 'cleanup':
        return await this.processCleanup(job.payload);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async processEmailNotification(payload: any): Promise<any> {
    // Simulate email sending
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 2000 + 1000)
    );

    if (Math.random() > 0.95) {
      // 5% failure rate
      throw new Error('Email service unavailable');
    }

    return { emailsSent: 1, messageId: 'msg-' + Date.now() };
  }

  private async processDataExport(payload: any): Promise<any> {
    // Simulate data export
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 5000 + 2000)
    );

    return {
      exportedRecords: Math.floor(Math.random() * 10000),
      fileSize: Math.floor(Math.random() * 1000000),
      exportPath: '/exports/data-' + Date.now() + '.csv',
    };
  }

  private async processReportGeneration(payload: any): Promise<any> {
    // Simulate report generation
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 10000 + 3000)
    );

    return {
      reportId: 'report-' + Date.now(),
      pageCount: Math.floor(Math.random() * 50) + 1,
      reportPath: '/reports/report-' + Date.now() + '.pdf',
    };
  }

  private async processCleanup(payload: any): Promise<any> {
    // Simulate cleanup operation
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 3000 + 1000)
    );

    return {
      itemsDeleted: Math.floor(Math.random() * 1000),
      spaceFreed: Math.floor(Math.random() * 1000000),
    };
  }

  private sanitizeJobPayload(payload: any): any {
    // Remove or mask sensitive data from job payload for logging
    if (typeof payload !== 'object') return payload;

    const sanitized = { ...payload };
    delete sanitized.password;
    delete sanitized.apiKey;
    delete sanitized.secret;

    return sanitized;
  }

  private sanitizeJobResult(result: any): any {
    // Limit result data for logging
    if (typeof result !== 'object') return result;

    const sanitized = { ...result };
    // Limit large arrays/objects
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 10) {
        sanitized[key] = `[${sanitized[key].length} items]`;
      }
    });

    return sanitized;
  }

  private isRetryableError(error: Error): boolean {
    // Define which errors are retryable
    const retryableErrors = [
      'timeout',
      'connection',
      'service unavailable',
      'rate limit',
    ];

    return retryableErrors.some(pattern =>
      error.message.toLowerCase().includes(pattern)
    );
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, attempt),
      maxDelay
    );
    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.floor(exponentialDelay + jitter);
  }

  private categorizePerformance(duration: number): string {
    if (duration < 1000) return 'fast';
    if (duration < 10000) return 'normal';
    if (duration < 60000) return 'slow';
    return 'very_slow';
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection'))
      return 'network';
    if (message.includes('memory')) return 'memory';
    if (message.includes('permission') || message.includes('unauthorized'))
      return 'permission';
    return 'unknown';
  }

  private getMemoryUsage(): any {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    };
  }

  private getJobTypeDistribution(jobs: Job[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    jobs.forEach(job => {
      distribution[job.type] = (distribution[job.type] || 0) + 1;
    });
    return distribution;
  }

  private getPriorityDistribution(jobs: Job[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    jobs.forEach(job => {
      const priority = job.priority || 'normal';
      distribution[priority] = (distribution[priority] || 0) + 1;
    });
    return distribution;
  }
}
```

## Use Case Summary

### Authentication Logging

- **Focus**: Security auditing and troubleshooting
- **Key Metrics**: Login attempts, success/failure rates, suspicious activity
- **Business Value**: Security monitoring, compliance, user experience

### Order Processing

- **Focus**: Business process tracking and error diagnosis
- **Key Metrics**: Processing time, failure points, completion rates
- **Business Value**: Operational visibility, customer service, process
  optimization

### API Monitoring

- **Focus**: Performance and usage tracking
- **Key Metrics**: Response times, error rates, rate limits
- **Business Value**: Service reliability, capacity planning, abuse prevention

### Job Processing

- **Focus**: Background task management and reliability
- **Key Metrics**: Job success rates, processing times, retry patterns
- **Business Value**: System reliability, resource optimization, SLA compliance

## Common Patterns Across Use Cases

### 1. **Contextual Logging**

- Always include relevant business context (user IDs, order IDs, request IDs)
- Use structured data for better analysis
- Maintain context throughout operation chains

### 2. **Performance Tracking**

- Log operation start and completion times
- Categorize performance levels for alerting
- Track resource usage for capacity planning

### 3. **Error Classification**

- Categorize errors by type and severity
- Determine retryability and recovery actions
- Log sufficient detail for troubleshooting

### 4. **Security Awareness**

- Mask sensitive data automatically
- Log security-relevant events (authentication, authorization)
- Track patterns that might indicate abuse

### 5. **Operational Metrics**

- Track success/failure rates
- Monitor trends and anomalies
- Provide data for business intelligence

## Best Practices Applied

- **Consistent log levels**: Error for failures, warn for issues, info for
  business events, debug for details
- **Structured data**: Use objects instead of string concatenation
- **Context preservation**: Maintain operation context throughout workflows
- **Performance awareness**: Don't log expensive operations at high frequency
- **Business relevance**: Include metrics that matter to business operations

## Related Examples

- [Basic Logger Setup](./example-1.md)
- [CQRS Integration Logging](./example-2.md)
- [Result Pattern Logging](./example-3.md)
- [Basic Implementation Guide](./implementation.md)
