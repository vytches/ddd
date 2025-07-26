# Advanced Error Hierarchies

**Version**: 2025-01-21  
**Package**: @vytches/ddd-domain-primitives  
**Complexity**: Intermediate  
**Category**: Errors

## Overview

Advanced error hierarchies provide structured error handling with
categorization, severity levels, and rich context propagation. This enables
sophisticated error handling strategies and better system observability.

## Comprehensive Error Hierarchy

```typescript
import {
  BaseError,
  IDomainError,
  DomainErrorCode,
  ApplicationErrorCode,
  FrameworkErrorCode,
} from '@vytches/ddd-domain-primitives';
import { ErrorContext } from '../types';

// ==================
// Base Error Categories
// ==================

export abstract class ApplicationError extends BaseError {
  abstract readonly category: ErrorCategory;
  abstract readonly severity: ErrorSeverity;
  abstract readonly retryable: boolean;

  constructor(
    message: string,
    public readonly context?: ErrorContext
  ) {
    super(message);
  }

  toJSON(): ErrorDetails {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      context: this.context,
      timestamp: new Date(),
      stack: this.stack,
    };
  }
}

export enum ErrorCategory {
  BUSINESS_RULE = 'business_rule',
  VALIDATION = 'validation',
  AUTHORIZATION = 'authorization',
  EXTERNAL_SERVICE = 'external_service',
  INFRASTRUCTURE = 'infrastructure',
  CONCURRENCY = 'concurrency',
  DATA_INTEGRITY = 'data_integrity',
}

export enum ErrorSeverity {
  LOW = 'low', // Log only
  MEDIUM = 'medium', // Alert ops team
  HIGH = 'high', // Page on-call
  CRITICAL = 'critical', // All hands
}

// ==================
// Business Rule Errors
// ==================

export abstract class BusinessRuleError extends ApplicationError {
  readonly category = ErrorCategory.BUSINESS_RULE;
  readonly retryable = false;

  constructor(
    message: string,
    public readonly rule: string,
    public readonly domain: string,
    context?: ErrorContext
  ) {
    super(message, context);
  }
}

export class InvariantViolationError extends BusinessRuleError {
  readonly severity = ErrorSeverity.HIGH;

  constructor(
    entity: string,
    invariant: string,
    details: Record<string, unknown>,
    context?: ErrorContext
  ) {
    super(
      `Invariant violation in ${entity}: ${invariant}`,
      invariant,
      entity,
      context
    );
    Object.assign(this, { details });
  }
}

export class PolicyViolationError extends BusinessRuleError {
  readonly severity = ErrorSeverity.MEDIUM;

  constructor(
    policy: string,
    violation: string,
    public readonly enforcementLevel: 'strict' | 'warning',
    context?: ErrorContext
  ) {
    super(
      `Policy violation: ${policy} - ${violation}`,
      policy,
      'PolicyEngine',
      context
    );
  }
}

// ==================
// Validation Errors
// ==================

export abstract class ValidationError extends ApplicationError {
  readonly category = ErrorCategory.VALIDATION;
  readonly retryable = false;

  constructor(
    message: string,
    public readonly validationErrors: ValidationErrorDetail[],
    context?: ErrorContext
  ) {
    super(message, context);
  }
}

export interface ValidationErrorDetail {
  field: string;
  value?: unknown;
  constraint: string;
  message: string;
}

export class EntityValidationError extends ValidationError {
  readonly severity = ErrorSeverity.MEDIUM;

  constructor(
    entityType: string,
    errors: ValidationErrorDetail[],
    context?: ErrorContext
  ) {
    super(`Validation failed for ${entityType}`, errors, context);
  }
}

export class CommandValidationError extends ValidationError {
  readonly severity = ErrorSeverity.LOW;

  constructor(
    commandName: string,
    errors: ValidationErrorDetail[],
    context?: ErrorContext
  ) {
    super(`Invalid command: ${commandName}`, errors, context);
  }
}

// ==================
// External Service Errors
// ==================

export abstract class ExternalServiceError extends ApplicationError {
  readonly category = ErrorCategory.EXTERNAL_SERVICE;

  constructor(
    message: string,
    public readonly service: string,
    public readonly operation: string,
    public readonly responseCode?: number,
    context?: ErrorContext
  ) {
    super(message, context);
  }
}

export class ServiceUnavailableError extends ExternalServiceError {
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = true;

  constructor(
    service: string,
    operation: string,
    public readonly retryAfter?: number,
    context?: ErrorContext
  ) {
    super(
      `Service ${service} is unavailable`,
      service,
      operation,
      503,
      context
    );
  }
}

export class RateLimitExceededError extends ExternalServiceError {
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;

  constructor(
    service: string,
    operation: string,
    public readonly limit: number,
    public readonly resetTime: Date,
    context?: ErrorContext
  ) {
    super(
      `Rate limit exceeded for ${service}`,
      service,
      operation,
      429,
      context
    );
  }
}

// ==================
// Infrastructure Errors
// ==================

export abstract class InfrastructureError extends ApplicationError {
  readonly category = ErrorCategory.INFRASTRUCTURE;
  readonly severity = ErrorSeverity.HIGH;

  constructor(
    message: string,
    public readonly component: string,
    public readonly recoverable: boolean,
    context?: ErrorContext
  ) {
    super(message, context);
  }

  get retryable(): boolean {
    return this.recoverable;
  }
}

export class DatabaseConnectionError extends InfrastructureError {
  constructor(
    database: string,
    public readonly connectionString: string,
    public readonly lastError?: Error,
    context?: ErrorContext
  ) {
    super(
      `Failed to connect to database: ${database}`,
      'database',
      true,
      context
    );
  }
}

export class MessageQueueError extends InfrastructureError {
  constructor(
    queue: string,
    operation: 'publish' | 'consume' | 'acknowledge',
    public readonly messageId?: string,
    context?: ErrorContext
  ) {
    super(
      `Message queue error: ${operation} failed on ${queue}`,
      'message_queue',
      operation !== 'acknowledge',
      context
    );
  }
}

// ==================
// Concurrency Errors
// ==================

export abstract class ConcurrencyError extends ApplicationError {
  readonly category = ErrorCategory.CONCURRENCY;
  readonly retryable = true;

  constructor(
    message: string,
    public readonly resourceId: string,
    public readonly resourceType: string,
    context?: ErrorContext
  ) {
    super(message, context);
  }
}

export class OptimisticLockError extends ConcurrencyError {
  readonly severity = ErrorSeverity.MEDIUM;

  constructor(
    resourceType: string,
    resourceId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
    context?: ErrorContext
  ) {
    super(
      `Optimistic lock failure on ${resourceType}:${resourceId}`,
      resourceId,
      resourceType,
      context
    );
  }
}

export class ResourceLockedError extends ConcurrencyError {
  readonly severity = ErrorSeverity.LOW;

  constructor(
    resourceType: string,
    resourceId: string,
    public readonly lockedBy: string,
    public readonly lockedUntil?: Date,
    context?: ErrorContext
  ) {
    super(
      `Resource ${resourceType}:${resourceId} is locked`,
      resourceId,
      resourceType,
      context
    );
  }
}
```

## Error Handler with Hierarchy Support

```typescript
// ==================
// Error Handler
// ==================

export class HierarchicalErrorHandler {
  private handlers: Map<ErrorCategory, ErrorHandler> = new Map();
  private defaultHandler: ErrorHandler;

  constructor() {
    this.defaultHandler = new DefaultErrorHandler();
    this.registerDefaultHandlers();
  }

  registerHandler(category: ErrorCategory, handler: ErrorHandler): void {
    this.handlers.set(category, handler);
  }

  async handle(error: Error): Promise<ErrorHandlingResult> {
    if (!(error instanceof ApplicationError)) {
      return this.defaultHandler.handle(error);
    }

    const handler = this.handlers.get(error.category) || this.defaultHandler;
    const result = await handler.handle(error);

    // Apply severity-based actions
    await this.applySeverityActions(error);

    return result;
  }

  private async applySeverityActions(error: ApplicationError): Promise<void> {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        await this.notifyOncall(error);
        await this.createIncident(error);
        break;
      case ErrorSeverity.HIGH:
        await this.notifyOpsTeam(error);
        break;
      case ErrorSeverity.MEDIUM:
        await this.logToMonitoring(error);
        break;
      case ErrorSeverity.LOW:
        // Just log
        break;
    }
  }

  private registerDefaultHandlers(): void {
    this.registerHandler(
      ErrorCategory.BUSINESS_RULE,
      new BusinessRuleErrorHandler()
    );
    this.registerHandler(
      ErrorCategory.VALIDATION,
      new ValidationErrorHandler()
    );
    this.registerHandler(
      ErrorCategory.EXTERNAL_SERVICE,
      new ExternalServiceErrorHandler()
    );
    this.registerHandler(
      ErrorCategory.INFRASTRUCTURE,
      new InfrastructureErrorHandler()
    );
    this.registerHandler(
      ErrorCategory.CONCURRENCY,
      new ConcurrencyErrorHandler()
    );
  }

  private async notifyOncall(error: ApplicationError): Promise<void> {
    console.error('🚨 CRITICAL ERROR - Paging on-call:', error.toJSON());
  }

  private async createIncident(error: ApplicationError): Promise<void> {
    console.error('📋 Creating incident for:', error.message);
  }

  private async notifyOpsTeam(error: ApplicationError): Promise<void> {
    console.warn('⚠️ HIGH SEVERITY - Notifying ops:', error.message);
  }

  private async logToMonitoring(error: ApplicationError): Promise<void> {
    console.info('📊 Logging to monitoring:', error.category, error.message);
  }
}

// ==================
// Specific Error Handlers
// ==================

interface ErrorHandler {
  handle(error: ApplicationError): Promise<ErrorHandlingResult>;
}

interface ErrorHandlingResult {
  handled: boolean;
  retry?: boolean;
  fallbackAction?: string;
  userMessage?: string;
}

class BusinessRuleErrorHandler implements ErrorHandler {
  async handle(error: BusinessRuleError): Promise<ErrorHandlingResult> {
    // Log business rule violation
    console.error('Business rule violated:', {
      rule: error.rule,
      domain: error.domain,
      message: error.message,
    });

    return {
      handled: true,
      retry: false,
      userMessage: `Business rule violation: ${error.message}`,
    };
  }
}

class ValidationErrorHandler implements ErrorHandler {
  async handle(error: ValidationError): Promise<ErrorHandlingResult> {
    // Format validation errors for user
    const fieldErrors = error.validationErrors
      .map(e => `${e.field}: ${e.message}`)
      .join(', ');

    return {
      handled: true,
      retry: false,
      userMessage: `Validation failed: ${fieldErrors}`,
    };
  }
}

class ExternalServiceErrorHandler implements ErrorHandler {
  async handle(error: ExternalServiceError): Promise<ErrorHandlingResult> {
    // Implement circuit breaker logic
    if (error instanceof ServiceUnavailableError) {
      return {
        handled: true,
        retry: true,
        fallbackAction: 'use_cache',
        userMessage: 'Service temporarily unavailable. Using cached data.',
      };
    }

    if (error instanceof RateLimitExceededError) {
      const waitTime = error.resetTime.getTime() - Date.now();
      return {
        handled: true,
        retry: true,
        userMessage: `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
      };
    }

    return {
      handled: true,
      retry: error.retryable,
      userMessage: 'External service error. Please try again later.',
    };
  }
}

class InfrastructureErrorHandler implements ErrorHandler {
  async handle(error: InfrastructureError): Promise<ErrorHandlingResult> {
    // Trigger infrastructure recovery
    if (error instanceof DatabaseConnectionError) {
      // Attempt reconnection
      console.error('Database connection failed, attempting recovery...');
    }

    return {
      handled: true,
      retry: error.recoverable,
      fallbackAction: 'graceful_degradation',
      userMessage: 'System issue detected. Our team has been notified.',
    };
  }
}

class ConcurrencyErrorHandler implements ErrorHandler {
  async handle(error: ConcurrencyError): Promise<ErrorHandlingResult> {
    if (error instanceof OptimisticLockError) {
      return {
        handled: true,
        retry: true,
        userMessage:
          'The data has been modified. Please refresh and try again.',
      };
    }

    if (error instanceof ResourceLockedError) {
      const waitMessage = error.lockedUntil
        ? ` Try again after ${error.lockedUntil.toLocaleTimeString()}.`
        : ' Please try again in a few moments.';

      return {
        handled: true,
        retry: true,
        userMessage: `Resource is currently in use.${waitMessage}`,
      };
    }

    return {
      handled: true,
      retry: true,
      userMessage: 'Resource conflict. Please try again.',
    };
  }
}

class DefaultErrorHandler implements ErrorHandler {
  async handle(error: Error): Promise<ErrorHandlingResult> {
    console.error('Unhandled error:', error);

    return {
      handled: false,
      retry: false,
      userMessage: 'An unexpected error occurred. Please contact support.',
    };
  }
}
```

## Usage Examples

```typescript
// ==================
// Usage Examples
// ==================

export class OrderProcessingService {
  private errorHandler: HierarchicalErrorHandler;

  constructor() {
    this.errorHandler = new HierarchicalErrorHandler();
  }

  async processOrder(orderId: string): Promise<void> {
    try {
      // Validate order invariants
      const order = await this.loadOrder(orderId);

      if (order.total <= 0) {
        throw new InvariantViolationError(
          'Order',
          'Total must be positive',
          { orderId, total: order.total },
          { correlationId: this.getCorrelationId() }
        );
      }

      // Check business policies
      if (order.items.length > 100) {
        throw new PolicyViolationError(
          'MaxItemsPolicy',
          'Order exceeds maximum item limit',
          'strict',
          { correlationId: this.getCorrelationId() }
        );
      }

      // Process payment
      await this.processPayment(order);
    } catch (error) {
      const result = await this.errorHandler.handle(error as Error);

      if (result.retry) {
        // Implement retry logic
        console.log('Retrying operation...');
      }

      if (result.fallbackAction) {
        await this.executeFallback(result.fallbackAction);
      }

      // Re-throw if not handled
      if (!result.handled) {
        throw error;
      }
    }
  }

  async validateOrder(order: any): Promise<void> {
    const errors: ValidationErrorDetail[] = [];

    if (!order.customerId) {
      errors.push({
        field: 'customerId',
        constraint: 'required',
        message: 'Customer ID is required',
      });
    }

    if (!order.items || order.items.length === 0) {
      errors.push({
        field: 'items',
        constraint: 'minLength',
        message: 'At least one item is required',
        value: order.items,
      });
    }

    if (errors.length > 0) {
      throw new EntityValidationError('Order', errors);
    }
  }

  async callExternalPaymentService(order: any): Promise<void> {
    try {
      // Simulate external call
      const response = await this.paymentGateway.charge(order);

      if (response.status === 503) {
        throw new ServiceUnavailableError(
          'PaymentGateway',
          'charge',
          300, // Retry after 5 minutes
          { correlationId: this.getCorrelationId() }
        );
      }

      if (response.status === 429) {
        throw new RateLimitExceededError(
          'PaymentGateway',
          'charge',
          100,
          new Date(Date.now() + 60000),
          { correlationId: this.getCorrelationId() }
        );
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ExternalServiceError(
        `Payment processing failed: ${(error as Error).message}`,
        'PaymentGateway',
        'charge',
        undefined,
        { correlationId: this.getCorrelationId() }
      );
    }
  }

  private async loadOrder(orderId: string): Promise<any> {
    // Load order logic
    return { id: orderId, total: 100, items: [] };
  }

  private async processPayment(order: any): Promise<void> {
    // Payment processing logic
  }

  private async executeFallback(action: string): Promise<void> {
    console.log(`Executing fallback: ${action}`);
  }

  private getCorrelationId(): string {
    return `corr_${Date.now()}`;
  }

  private paymentGateway = {
    charge: async (order: any) => ({ status: 200 }),
  };
}
```

## Error Type Definitions

```typescript
// ==================
// Type Definitions
// ==================

interface ErrorDetails {
  name: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  context?: ErrorContext;
  timestamp: Date;
  stack?: string;
}

// Error aggregation for reporting
export class ErrorAggregator {
  private errors: ApplicationError[] = [];

  add(error: ApplicationError): void {
    this.errors.push(error);
  }

  getBySeverity(severity: ErrorSeverity): ApplicationError[] {
    return this.errors.filter(e => e.severity === severity);
  }

  getByCategory(category: ErrorCategory): ApplicationError[] {
    return this.errors.filter(e => e.category === category);
  }

  getCriticalErrors(): ApplicationError[] {
    return this.getBySeverity(ErrorSeverity.CRITICAL);
  }

  getRetryableErrors(): ApplicationError[] {
    return this.errors.filter(e => e.retryable);
  }

  generateReport(): ErrorReport {
    return {
      total: this.errors.length,
      bySeverity: {
        critical: this.getBySeverity(ErrorSeverity.CRITICAL).length,
        high: this.getBySeverity(ErrorSeverity.HIGH).length,
        medium: this.getBySeverity(ErrorSeverity.MEDIUM).length,
        low: this.getBySeverity(ErrorSeverity.LOW).length,
      },
      byCategory: Object.values(ErrorCategory).reduce(
        (acc, category) => {
          acc[category] = this.getByCategory(category).length;
          return acc;
        },
        {} as Record<ErrorCategory, number>
      ),
      retryable: this.getRetryableErrors().length,
      timestamp: new Date(),
    };
  }
}

interface ErrorReport {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<ErrorCategory, number>;
  retryable: number;
  timestamp: Date;
}
```

## Key Benefits

1. **Structured Classification**: Errors are organized by category and severity
2. **Automatic Handling**: Category-specific handlers manage different error
   types
3. **Rich Context**: Errors carry detailed information for debugging
4. **Retry Logic**: Built-in support for retryable operations
5. **Severity Actions**: Automatic escalation based on error severity

## Best Practices

1. **Use specific error types** for different scenarios
2. **Include rich context** for debugging
3. **Set appropriate severity levels** for proper escalation
4. **Implement category-specific handlers** for better error management
5. **Track error metrics** for system health monitoring

## Next Steps

- Implement error recovery strategies
- Add error correlation across services
- Build error monitoring dashboards
- Create error documentation generator
