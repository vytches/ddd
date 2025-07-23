# NestJS Service Integration

**Version**: 1.0.0 **Package**: @vytches-ddd/logging + NestJS **Complexity**:
basic **Framework**: NestJS **Integration**: Complete service integration with
logging middleware **Dependencies**: @nestjs/common, @vytches-ddd/logging

## Description

Complete NestJS service integration with logging middleware, request/response
tracking, and comprehensive error handling. This example demonstrates
production-ready logging patterns for NestJS applications with middleware
integration and service-wide logging strategies.

## Business Context

Production NestJS applications require comprehensive logging that captures HTTP
requests, service operations, and system events while maintaining performance.
This integration provides complete observability for debugging issues,
monitoring performance, and understanding user behavior patterns.

## Code Example

```typescript
// logging.module.ts - Dedicated logging module
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { LoggingService } from './logging.service';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { ErrorLoggingFilter } from './error-logging.filter';
import { PerformanceInterceptor } from './performance.interceptor';

@Global()
@Module({
  providers: [
    LoggingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    // Error filter would be registered in main.ts for global scope
  ],
  exports: [LoggingService],
})
export class LoggingModule {}

// logging.service.ts - Enhanced logging service
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger, LoggerConfiguration } from '@vytches-ddd/logging';

@Injectable()
export class LoggingService implements OnModuleInit, OnModuleDestroy {
  private logger: Logger;
  private requestId: string = '';

  async onModuleInit() {
    // ⭐ FOCUS: Production-ready logger configuration
    const config: LoggerConfiguration = {
      level:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      enableConsoleOutput: true,
      enableFileOutput: process.env.NODE_ENV === 'production',

      contextDetection: {
        enabled: true,
        stackTraceAnalysis: true,
        boundedContextDetection: true,
      },

      masking: {
        enabled: true,
        sensitiveKeys: [
          'password',
          'secret',
          'token',
          'apiKey',
          'cardNumber',
          'ssn',
          'phoneNumber',
          'authorization',
          'cookie',
        ],
        replacement: '[MASKED]',
        customMaskers: {
          email: (email: string) => {
            const [local, domain] = email.split('@');
            return `${local[0]}***@${domain}`;
          },
          phone: (phone: string) => phone.replace(/\d(?=\d{4})/g, '*'),
        },
      },

      formatting: {
        colorize: process.env.NODE_ENV === 'development',
        timestamp: true,
        prettyPrint: process.env.NODE_ENV === 'development',
      },
    };

    Logger.configure(config);
    this.logger = Logger.forContext('LoggingService');

    this.logger.info('Logging system initialized', {
      environment: process.env.NODE_ENV,
      logLevel: config.level,
      version: process.env.npm_package_version || '1.0.0',
    });
  }

  async onModuleDestroy() {
    this.logger.info('Logging service shutting down');
  }

  // ⭐ FOCUS: Request context management
  setRequestContext(requestId: string): void {
    this.requestId = requestId;
  }

  getRequestContext(): string {
    return this.requestId;
  }

  // ⭐ FOCUS: Create contextual loggers
  createLogger(
    context: string,
    additionalContext?: Record<string, any>
  ): Logger {
    return Logger.forContext(context).withContext({
      requestId: this.requestId,
      ...additionalContext,
    });
  }

  // ⭐ FOCUS: Application lifecycle logging
  logApplicationStartup(startupInfo: Record<string, any>): void {
    this.logger.info('Application startup', {
      ...startupInfo,
      timestamp: new Date(),
      processId: process.pid,
      nodeVersion: process.version,
    });
  }

  logApplicationShutdown(): void {
    this.logger.info('Application shutdown initiated', {
      uptime: process.uptime(),
      timestamp: new Date(),
      processId: process.pid,
    });
  }

  // ⭐ FOCUS: Business event logging
  logBusinessEvent(
    event: string,
    data: Record<string, any>,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    this.logger[level](`Business event: ${event}`, {
      event,
      data,
      requestId: this.requestId,
      timestamp: new Date(),
    });
  }

  // ⭐ FOCUS: Performance metric logging
  logPerformanceMetric(
    operation: string,
    duration: number,
    additionalMetrics?: Record<string, any>
  ): void {
    const performanceCategory = this.categorizePerformance(duration);

    this.logger.info('Performance metric', {
      operation,
      duration,
      performanceCategory,
      requestId: this.requestId,
      ...additionalMetrics,
      timestamp: new Date(),
    });

    if (duration > 5000) {
      // Log slow operations
      this.logger.warn('Slow operation detected', {
        operation,
        duration,
        threshold: 5000,
        requestId: this.requestId,
      });
    }
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 2000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'critical';
  }
}

// request-logging.interceptor.ts - HTTP request/response logging
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggingService } from './logging.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate unique request ID
    const requestId = uuidv4();
    request.requestId = requestId;
    this.loggingService.setRequestContext(requestId);

    const logger = this.loggingService.createLogger('HttpRequest');
    const startTime = Date.now();

    // ⭐ FOCUS: Log incoming request
    logger.info('HTTP request received', {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
      headers: this.sanitizeHeaders(request.headers),
      query: request.query,
      contentLength: request.get('content-length') || 0,
      timestamp: new Date(),
    });

    return next.handle().pipe(
      tap(data => {
        const duration = Date.now() - startTime;
        const responseSize = JSON.stringify(data || {}).length;

        // ⭐ FOCUS: Log successful response
        logger.info('HTTP request completed', {
          requestId,
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          duration,
          responseSize,
          performanceCategory: this.categorizePerformance(duration),
        });

        // Log performance metrics
        this.loggingService.logPerformanceMetric('http_request', duration, {
          endpoint: `${request.method} ${request.route?.path || request.url}`,
          statusCode: response.statusCode,
          responseSize,
        });
      }),
      catchError(error => {
        const duration = Date.now() - startTime;

        // ⭐ FOCUS: Log request error
        logger.error('HTTP request failed', {
          requestId,
          method: request.method,
          url: request.url,
          duration,
          error: error,
          errorMessage: error?.message,
          statusCode: error?.status || 500,
        });

        throw error;
      })
    );
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    delete sanitized['x-auth-token'];

    return sanitized;
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 2000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'critical';
  }
}

// performance.interceptor.ts - Performance monitoring
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggingService } from './logging.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const endMemory = process.memoryUsage();
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        // ⭐ FOCUS: Log method performance
        this.loggingService.logPerformanceMetric(
          `${className}.${methodName}`,
          duration,
          {
            memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(endMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          }
        );
      })
    );
  }
}

// error-logging.filter.ts - Global error handling with logging
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggingService } from './logging.service';

@Catch()
export class ErrorLoggingFilter implements ExceptionFilter {
  constructor(private readonly loggingService: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const logger = this.loggingService.createLogger('ErrorHandler');

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    // ⭐ FOCUS: Log error with comprehensive context
    const logLevel = status >= 500 ? 'error' : 'warn';
    logger[logLevel]('HTTP error occurred', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: status,
      error: exception,
      errorMessage:
        exception instanceof Error ? exception.message : 'Unknown error',
      errorType: exception?.constructor?.name || 'Unknown',
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
      timestamp: new Date(),
    });

    // Log business event for significant errors
    if (status >= 500) {
      this.loggingService.logBusinessEvent(
        'ServerError',
        {
          statusCode: status,
          endpoint: `${request.method} ${request.url}`,
          errorType: exception?.constructor?.name,
        },
        'error'
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message:
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse as any)?.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId,
    });
  }
}

// Enhanced service example with comprehensive logging
import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { UserData, CreateUserRequest, UpdateUserRequest } from './types';

@Injectable()
export class UserService implements OnModuleInit {
  private logger: Logger;

  constructor(private readonly loggingService: LoggingService) {}

  onModuleInit() {
    this.logger = this.loggingService.createLogger('UserService');
  }

  async createUser(createUserDto: CreateUserRequest): Promise<UserData> {
    const operationLogger = this.loggingService.createLogger('UserService', {
      operation: 'createUser',
      email: createUserDto.email, // Will be masked
    });

    const startTime = Date.now();

    // ⭐ FOCUS: Log operation start with context
    operationLogger.info('User creation started', {
      email: createUserDto.email, // Masked
      role: createUserDto.role,
      hasInitialData: !!createUserDto.initialData,
    });

    try {
      // Step 1: Validate input
      await this.validateUserInput(createUserDto, operationLogger);

      // Step 2: Check for existing user
      await this.checkUserExists(createUserDto.email, operationLogger);

      // Step 3: Create user record
      const user = await this.saveUserToDatabase(
        createUserDto,
        operationLogger
      );

      // Step 4: Send welcome email
      await this.sendWelcomeEmail(user, operationLogger);

      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Log successful completion
      operationLogger.info('User creation completed', {
        userId: user.id,
        email: user.email, // Masked
        role: user.role,
        duration,
        performanceCategory: this.categorizePerformance(duration),
      });

      // Log business event
      this.loggingService.logBusinessEvent('UserCreated', {
        userId: user.id,
        role: user.role,
        hasWelcomeEmail: true,
      });

      // Log performance metric
      this.loggingService.logPerformanceMetric('createUser', duration, {
        email: createUserDto.email, // Masked
        role: createUserDto.role,
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      const stage = this.determineFailureStage(error as Error);

      // ⭐ FOCUS: Log operation failure
      operationLogger.error('User creation failed', {
        email: createUserDto.email, // Masked
        error: error,
        stage,
        duration,
        attemptCount: 1,
      });

      // Log business event for failures
      this.loggingService.logBusinessEvent(
        'UserCreationFailed',
        {
          email: createUserDto.email, // Masked
          failureStage: stage,
          errorMessage: (error as Error).message,
        },
        'error'
      );

      throw error;
    }
  }

  async updateUser(
    id: string,
    updateData: UpdateUserRequest
  ): Promise<UserData> {
    const operationLogger = this.loggingService.createLogger('UserService', {
      operation: 'updateUser',
      userId: id,
    });

    operationLogger.info('User update started', {
      userId: id,
      fieldsToUpdate: Object.keys(updateData),
      updateCount: Object.keys(updateData).length,
    });

    const startTime = Date.now();

    try {
      // Validate user exists
      const existingUser = await this.findUserById(id);
      if (!existingUser) {
        throw new Error(`User with ID ${id} not found`);
      }

      // Track what's being changed
      const changes = this.detectChanges(existingUser, updateData);
      operationLogger.debug('User changes detected', {
        changes: changes,
        changeCount: changes.length,
      });

      // Update user
      const updatedUser = await this.updateUserInDatabase(
        id,
        updateData,
        operationLogger
      );
      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Log successful update
      operationLogger.info('User update completed', {
        userId: updatedUser.id,
        changedFields: changes,
        duration,
      });

      // Log significant changes as business events
      if (changes.includes('role') || changes.includes('isActive')) {
        this.loggingService.logBusinessEvent('UserSignificantChange', {
          userId: id,
          changedFields: changes,
          newRole: updateData.role,
          newStatus: updateData.isActive,
        });
      }

      return updatedUser;
    } catch (error) {
      const duration = Date.now() - startTime;

      operationLogger.error('User update failed', {
        userId: id,
        updateData: updateData,
        error: error,
        duration,
      });

      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    const operationLogger = this.loggingService.createLogger('UserService', {
      operation: 'deleteUser',
      userId: id,
    });

    operationLogger.warn('User deletion initiated', {
      userId: id,
      timestamp: new Date(),
    });

    try {
      // Get user details before deletion for logging
      const user = await this.findUserById(id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }

      // Perform soft delete
      await this.softDeleteUser(id, operationLogger);

      // ⭐ FOCUS: Log deletion with user context
      operationLogger.warn('User deleted', {
        userId: id,
        userEmail: user.email, // Masked
        userRole: user.role,
        deletionType: 'soft_delete',
      });

      // Log critical business event
      this.loggingService.logBusinessEvent(
        'UserDeleted',
        {
          userId: id,
          email: user.email, // Masked
          role: user.role,
        },
        'warn'
      );
    } catch (error) {
      operationLogger.error('User deletion failed', {
        userId: id,
        error: error,
      });

      throw error;
    }
  }

  // Helper methods with logging
  private async validateUserInput(
    input: CreateUserRequest,
    logger: Logger
  ): Promise<void> {
    logger.debug('Validating user input');

    const validationErrors: string[] = [];

    if (!input.email || !input.email.includes('@')) {
      validationErrors.push('Invalid email format');
    }

    if (!input.name || input.name.length < 2) {
      validationErrors.push('Name must be at least 2 characters');
    }

    if (validationErrors.length > 0) {
      logger.warn('User input validation failed', {
        validationErrors,
        errorCount: validationErrors.length,
      });
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    logger.debug('User input validation passed');
  }

  private async checkUserExists(email: string, logger: Logger): Promise<void> {
    logger.debug('Checking if user already exists', { email }); // Masked

    // Simulate database check
    const exists = Math.random() > 0.95; // 5% chance user exists

    if (exists) {
      logger.warn('User already exists', { email }); // Masked
      throw new Error('User with this email already exists');
    }

    logger.debug('User availability confirmed');
  }

  private async saveUserToDatabase(
    input: CreateUserRequest,
    logger: Logger
  ): Promise<UserData> {
    logger.debug('Saving user to database');

    // Simulate database save
    const user: UserData = {
      id: `user-${Date.now()}`,
      name: input.name,
      email: input.email,
      role: input.role,
      createdAt: new Date(),
      isActive: true,
    };

    logger.debug('User saved to database', {
      userId: user.id,
      email: user.email, // Masked
    });

    return user;
  }

  private async sendWelcomeEmail(
    user: UserData,
    logger: Logger
  ): Promise<void> {
    logger.debug('Sending welcome email', {
      userId: user.id,
      email: user.email, // Masked
    });

    // Simulate email sending
    if (Math.random() > 0.9) {
      // 10% failure rate
      logger.error('Welcome email failed', {
        userId: user.id,
        email: user.email, // Masked
      });
      throw new Error('Failed to send welcome email');
    }

    logger.info('Welcome email sent', {
      userId: user.id,
      email: user.email, // Masked
    });
  }

  // Additional helper methods...
  private async findUserById(id: string): Promise<UserData | null> {
    if (id === 'user-not-found') return null;

    return {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
      createdAt: new Date(),
      isActive: true,
    };
  }

  private async updateUserInDatabase(
    id: string,
    updateData: UpdateUserRequest,
    logger: Logger
  ): Promise<UserData> {
    logger.debug('Updating user in database', { userId: id });

    const existing = await this.findUserById(id);
    return {
      ...existing!,
      ...updateData,
      updatedAt: new Date(),
    };
  }

  private async softDeleteUser(id: string, logger: Logger): Promise<void> {
    logger.debug('Performing soft delete', { userId: id });
    // Simulate soft delete operation
  }

  private detectChanges(
    existing: UserData,
    updates: UpdateUserRequest
  ): string[] {
    const changes: string[] = [];

    Object.keys(updates).forEach(key => {
      if (
        existing[key as keyof UserData] !==
        updates[key as keyof UpdateUserRequest]
      ) {
        changes.push(key);
      }
    });

    return changes;
  }

  private determineFailureStage(error: Error): string {
    const message = error.message.toLowerCase();
    if (message.includes('validation')) return 'validation';
    if (message.includes('exists') || message.includes('duplicate'))
      return 'duplicate_check';
    if (message.includes('database') || message.includes('save'))
      return 'database_save';
    if (message.includes('email')) return 'welcome_email';
    return 'unknown';
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 2000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'critical';
  }
}

// main.ts - Application setup with logging
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErrorLoggingFilter } from './logging/error-logging.filter';
import { LoggingService } from './logging/logging.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get logging service
  const loggingService = app.get(LoggingService);

  // Set up global error filter
  app.useGlobalFilters(new ErrorLoggingFilter(loggingService));

  // Log application startup
  loggingService.logApplicationStartup({
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });

  await app.listen(process.env.PORT || 3000);

  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    loggingService.logApplicationShutdown();
    await app.close();
  });
}

bootstrap().catch(error => {
  console.error('Application bootstrap failed:', error);
  process.exit(1);
});
```

## Key Features

- **Complete Request Logging**: Automatic HTTP request/response tracking
- **Performance Monitoring**: Method execution time and memory usage tracking
- **Global Error Handling**: Comprehensive error logging with context
- **Business Event Logging**: Track important business operations
- **Service Integration**: Easy integration with existing NestJS services
- **Context Propagation**: Request context maintained across service calls
- **Automatic Data Masking**: Sensitive data protected in all logs
- **Production Ready**: Optimized for production environments

## Module Integration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggingModule } from './logging/logging.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    LoggingModule, // Import logging module first
    UserModule,
    // Other modules
  ],
})
export class AppModule {}
```

## Configuration Options

```typescript
// Environment-specific configuration
const getConfig = (): LoggerConfiguration => ({
  level: process.env.LOG_LEVEL || 'info',
  enableConsoleOutput: true,
  enableFileOutput: process.env.NODE_ENV === 'production',
  enableRemoteLogging: process.env.ENABLE_REMOTE_LOGGING === 'true',

  masking: {
    enabled: true,
    sensitiveKeys:
      process.env.NODE_ENV === 'production'
        ? [
            'password',
            'secret',
            'token',
            'apiKey',
            'cardNumber',
            'ssn',
            'email',
            'phoneNumber',
          ]
        : ['password', 'secret', 'token', 'apiKey'],
  },

  formatting: {
    colorize: process.env.NODE_ENV === 'development',
    prettyPrint: process.env.NODE_ENV === 'development',
    timestamp: true,
  },
});
```

## Best Practices

- Use `@Global()` decorator on LoggingModule for application-wide availability
- Register interceptors at the application level for complete request coverage
- Always include request IDs for request correlation
- Log both successful operations and failures with appropriate context
- Use performance interceptors to monitor slow operations
- Implement graceful shutdown logging for production monitoring
- Configure different log levels per environment

## Common Pitfalls

- **Missing Request Context**: Ensure request IDs are propagated throughout
  request lifecycle
- **Over-logging in Production**: Use appropriate log levels to avoid
  performance impact
- **Sensitive Data Exposure**: Ensure comprehensive masking configuration
- **Memory Leaks**: Properly clean up logging context in long-running operations
- **Performance Impact**: Monitor logging overhead in high-throughput
  applications

## Related Examples

- [NestJS Manual Setup](./example-1.md)
- [NestJS Advanced DI Integration](../intermediate/example-1.md)
- [Basic Implementation Guide](../../basic/implementation.md)
