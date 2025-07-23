# Basic Logging Implementation Guide

**Version**: 1.0.0
**Package**: @vytches-ddd/logging
**Complexity**: basic
**Domain**: Implementation Guidance
**Patterns**: Setup, configuration, integration strategies
**Dependencies**: @vytches-ddd/logging

## Overview

This guide provides step-by-step implementation guidance for integrating @vytches-ddd/logging into applications. It covers basic setup patterns, configuration strategies, and common integration approaches for different development scenarios.

## Implementation Steps

### 1. Package Installation and Setup

```bash
# Install the logging package
npm install @vytches-ddd/logging

# For TypeScript projects, types are included
# No additional @types package needed
```

### 2. Basic Configuration Setup

```typescript
// logger.config.ts - Central configuration file
import { Logger, LoggerConfiguration } from '@vytches-ddd/logging';

export const createLoggerConfig = (): LoggerConfiguration => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    enableConsoleOutput: true,
    enableFileOutput: !isDevelopment, // File logging in production
    
    // ⭐ FOCUS: Context detection configuration
    contextDetection: {
      enabled: true,
      stackTraceAnalysis: true,
      boundedContextDetection: true
    },
    
    // ⭐ FOCUS: Data masking configuration
    masking: {
      enabled: true,
      sensitiveKeys: [
        'password',
        'secret',
        'token',
        'apiKey',
        'cardNumber',
        'ssn',
        'phoneNumber'
      ],
      replacement: '[MASKED]',
      customMaskers: {
        email: (email: string) => {
          const [local, domain] = email.split('@');
          return `${local[0]}***@${domain}`;
        },
        phone: (phone: string) => {
          return phone.replace(/\d(?=\d{4})/g, '*');
        }
      }
    },
    
    // Environment-specific formatting
    formatting: {
      colorize: isDevelopment,
      timestamp: true,
      prettyPrint: isDevelopment
    }
  };
};

// Initialize global logger configuration
export const initializeLogging = (): void => {
  const config = createLoggerConfig();
  Logger.configure(config);
  
  console.log('✅ Logging system initialized');
};
```

### 3. Application Bootstrap Integration

```typescript
// main.ts - Application entry point
import { initializeLogging } from './config/logger.config';
import { Logger } from '@vytches-ddd/logging';

async function bootstrap(): Promise<void> {
  // ⭐ CRITICAL: Initialize logging FIRST
  initializeLogging();
  
  const appLogger = Logger.forContext('Application');
  
  try {
    appLogger.info('Application starting up', {
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });
    
    // Start your application
    await startApplication();
    
    appLogger.info('Application started successfully', {
      port: process.env.PORT || 3000,
      timestamp: new Date()
    });
    
  } catch (error) {
    appLogger.error('Application startup failed', {
      error: error,
      timestamp: new Date()
    });
    
    process.exit(1);
  }
}

async function startApplication(): Promise<void> {
  // Your application startup logic
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
```

### 4. Service Layer Integration

```typescript
// user.service.ts - Business service example
import { Logger } from '@vytches-ddd/logging';
import { UserData, CreateUserRequest } from './types';

export class UserService {
  private logger = Logger.forContext(); // Auto-detects "UserService"

  async createUser(request: CreateUserRequest): Promise<UserData> {
    // ⭐ FOCUS: Operation logging with context
    this.logger.info('Creating new user', {
      email: request.email, // Automatically masked
      role: request.role,
      operation: 'createUser'
    });

    try {
      // Validate input
      await this.validateUserRequest(request);
      
      // Create user
      const user = await this.saveUser(request);
      
      // ⭐ FOCUS: Success logging
      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email, // Masked
        role: user.role
      });
      
      return user;
      
    } catch (error) {
      // ⭐ FOCUS: Error logging with context
      this.logger.error('User creation failed', {
        email: request.email, // Masked
        error: error,
        operation: 'createUser'
      });
      
      throw error;
    }
  }

  async getUserById(userId: string): Promise<UserData | null> {
    this.logger.debug('Fetching user by ID', { userId });

    try {
      const user = await this.loadUser(userId);
      
      if (!user) {
        this.logger.warn('User not found', { userId });
        return null;
      }

      this.logger.debug('User fetched successfully', { 
        userId: user.id,
        isActive: user.isActive 
      });

      return user;

    } catch (error) {
      this.logger.error('Failed to fetch user', {
        userId,
        error: error
      });
      throw error;
    }
  }

  private async validateUserRequest(request: CreateUserRequest): Promise<void> {
    if (!request.email?.includes('@')) {
      throw new Error('Invalid email format');
    }
    
    this.logger.debug('User request validated', {
      email: request.email // Masked
    });
  }

  private async saveUser(request: CreateUserRequest): Promise<UserData> {
    // Simulate user creation
    const user: UserData = {
      id: 'user-' + Date.now(),
      name: request.name,
      email: request.email,
      role: request.role,
      createdAt: new Date(),
      isActive: true
    };

    this.logger.debug('User saved to database', {
      userId: user.id,
      email: user.email // Masked
    });

    return user;
  }

  private async loadUser(userId: string): Promise<UserData | null> {
    // Simulate database lookup
    if (userId === 'user-not-found') {
      return null;
    }

    return {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
      createdAt: new Date(),
      isActive: true
    };
  }
}
```

### 5. Error Handling Integration

```typescript
// error-handler.ts - Centralized error handling
import { Logger } from '@vytches-ddd/logging';

export class ApplicationErrorHandler {
  private logger = Logger.forContext('ErrorHandler');

  handleError(error: Error, context?: Record<string, any>): void {
    const errorContext = {
      errorType: error.constructor.name,
      timestamp: new Date(),
      ...context
    };

    if (this.isCriticalError(error)) {
      // ⭐ FOCUS: Critical error logging
      this.logger.error('Critical error occurred', {
        error: error,
        context: errorContext,
        stackTrace: error.stack,
        severity: 'critical'
      });
      
      // Could trigger alerts, notifications, etc.
      this.notifyOperationsTeam(error, errorContext);
      
    } else if (this.isBusinessError(error)) {
      // ⭐ FOCUS: Business error logging
      this.logger.warn('Business logic error', {
        error: error,
        context: errorContext,
        severity: 'business'
      });
      
    } else {
      // ⭐ FOCUS: General error logging
      this.logger.error('Unexpected error occurred', {
        error: error,
        context: errorContext,
        severity: 'error'
      });
    }
  }

  handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    this.logger.error('Unhandled promise rejection', {
      reason: reason,
      promise: promise.toString(),
      severity: 'critical',
      type: 'unhandledRejection'
    });
  }

  handleUncaughtException(error: Error): void {
    this.logger.error('Uncaught exception', {
      error: error,
      stackTrace: error.stack,
      severity: 'critical',
      type: 'uncaughtException'
    });
    
    // Graceful shutdown
    process.exit(1);
  }

  private isCriticalError(error: Error): boolean {
    return error.message.includes('CRITICAL') || 
           error.name.includes('System') ||
           error.message.includes('Database connection');
  }

  private isBusinessError(error: Error): boolean {
    return error.name.includes('Business') || 
           error.name.includes('Validation');
  }

  private notifyOperationsTeam(error: Error, context: any): void {
    // Integration with monitoring/alerting systems
    console.log('🚨 Critical error notification sent');
  }
}

// Global error handler setup
export const setupGlobalErrorHandling = (): void => {
  const errorHandler = new ApplicationErrorHandler();

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    errorHandler.handleUnhandledRejection(reason, promise);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    errorHandler.handleUncaughtException(error);
  });
};
```

### 6. Middleware Integration

```typescript
// logging.middleware.ts - HTTP request logging
import { Logger } from '@vytches-ddd/logging';

export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  userId?: string;
}

export class LoggingMiddleware {
  private logger = Logger.forContext('HttpRequests');

  createRequestLoggingMiddleware() {
    return (req: any, res: any, next: any) => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();
      
      // Add request ID to request for downstream use
      req.requestId = requestId;
      
      const requestContext: RequestContext = {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id // If authentication middleware sets user
      };

      // ⭐ FOCUS: Log incoming request
      this.logger.info('Incoming HTTP request', {
        ...requestContext,
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        timestamp: new Date()
      });

      // Capture response
      const originalSend = res.send.bind(res);
      res.send = (body: any) => {
        const duration = Date.now() - startTime;
        
        // ⭐ FOCUS: Log outgoing response
        this.logger.info('HTTP request completed', {
          ...requestContext,
          statusCode: res.statusCode,
          duration,
          responseSize: body ? JSON.stringify(body).length : 0,
          timestamp: new Date()
        });

        return originalSend(body);
      };

      // Handle errors
      res.on('error', (error: Error) => {
        const duration = Date.now() - startTime;
        
        // ⭐ FOCUS: Log request errors
        this.logger.error('HTTP request failed', {
          ...requestContext,
          error: error,
          duration,
          timestamp: new Date()
        });
      });

      next();
    };
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }
}
```

### 7. Database Operation Logging

```typescript
// database.service.ts - Database operation logging
import { Logger } from '@vytches-ddd/logging';

export class DatabaseService {
  private logger = Logger.forContext();

  async executeQuery<T>(
    query: string,
    parameters?: any[],
    context?: Record<string, any>
  ): Promise<T> {
    const queryId = `query-${Date.now()}`;
    const queryLogger = this.logger.withContext({
      queryId,
      operation: 'database-query',
      ...context
    });

    // ⭐ FOCUS: Log query execution
    queryLogger.debug('Executing database query', {
      query: this.sanitizeQuery(query),
      parameterCount: parameters?.length || 0,
      timestamp: new Date()
    });

    const startTime = Date.now();

    try {
      // Execute query (pseudo-code)
      const result = await this.executeQueryInternal<T>(query, parameters);
      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Log successful query
      queryLogger.info('Database query completed', {
        queryId,
        duration,
        resultCount: Array.isArray(result) ? result.length : 1,
        performance: this.categorizePerformance(duration)
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Log query failure
      queryLogger.error('Database query failed', {
        queryId,
        duration,
        error: error,
        query: this.sanitizeQuery(query)
      });

      throw error;
    }
  }

  async executeTransaction<T>(
    operations: (() => Promise<any>)[],
    context?: Record<string, any>
  ): Promise<T> {
    const transactionId = `tx-${Date.now()}`;
    const txLogger = this.logger.withContext({
      transactionId,
      operation: 'database-transaction',
      ...context
    });

    txLogger.info('Starting database transaction', {
      operationCount: operations.length,
      timestamp: new Date()
    });

    const startTime = Date.now();

    try {
      // Begin transaction
      await this.beginTransaction();
      
      const results = [];
      for (let i = 0; i < operations.length; i++) {
        txLogger.debug(`Executing transaction operation ${i + 1}/${operations.length}`);
        const result = await operations[i]();
        results.push(result);
      }

      // Commit transaction
      await this.commitTransaction();
      const duration = Date.now() - startTime;

      txLogger.info('Database transaction committed', {
        transactionId,
        operationCount: operations.length,
        duration
      });

      return results as T;

    } catch (error) {
      // Rollback transaction
      await this.rollbackTransaction();
      const duration = Date.now() - startTime;

      txLogger.error('Database transaction rolled back', {
        transactionId,
        error: error,
        duration
      });

      throw error;
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove or mask sensitive data from queries for logging
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password = '[MASKED]'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret = '[MASKED]'");
  }

  private categorizePerformance(durationMs: number): string {
    if (durationMs < 50) return 'excellent';
    if (durationMs < 200) return 'good';
    if (durationMs < 1000) return 'acceptable';
    if (durationMs < 5000) return 'slow';
    return 'critical';
  }

  // Mock database methods
  private async executeQueryInternal<T>(query: string, parameters?: any[]): Promise<T> {
    // Simulate database execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    return {} as T;
  }

  private async beginTransaction(): Promise<void> {
    this.logger.debug('Transaction began');
  }

  private async commitTransaction(): Promise<void> {
    this.logger.debug('Transaction committed');
  }

  private async rollbackTransaction(): Promise<void> {
    this.logger.debug('Transaction rolled back');
  }
}
```

## Configuration Strategies

### 1. Environment-Based Configuration

```typescript
// config/environments/development.ts
export const developmentConfig = {
  level: 'debug',
  enableConsoleOutput: true,
  enableFileOutput: false,
  formatting: {
    colorize: true,
    prettyPrint: true,
    timestamp: true
  },
  masking: {
    enabled: true,
    // More lenient masking in development
    sensitiveKeys: ['password', 'secret', 'token']
  }
};

// config/environments/production.ts
export const productionConfig = {
  level: 'info',
  enableConsoleOutput: false,
  enableFileOutput: true,
  enableRemoteLogging: true,
  formatting: {
    colorize: false,
    prettyPrint: false,
    timestamp: true
  },
  masking: {
    enabled: true,
    // Comprehensive masking in production
    sensitiveKeys: [
      'password', 'secret', 'token', 'apiKey',
      'cardNumber', 'ssn', 'phoneNumber', 'email'
    ]
  }
};

// config/logger.factory.ts
import { developmentConfig } from './environments/development';
import { productionConfig } from './environments/production';

export const createEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionConfig;
    case 'staging':
      return { ...productionConfig, level: 'debug' }; // More verbose in staging
    case 'test':
      return { ...developmentConfig, level: 'error' }; // Quiet during tests
    default:
      return developmentConfig;
  }
};
```

### 2. Feature-Based Configuration

```typescript
// config/features.ts
export interface FeatureFlags {
  enablePerformanceLogging: boolean;
  enableSecurityAuditing: boolean;
  enableBusinessEventLogging: boolean;
  enableRequestTracing: boolean;
}

export const createFeatureBasedConfig = (features: FeatureFlags) => {
  const baseConfig = createEnvironmentConfig();
  
  return {
    ...baseConfig,
    
    // Conditional features based on flags
    contextDetection: {
      ...baseConfig.contextDetection,
      performanceTracking: features.enablePerformanceLogging
    },
    
    masking: {
      ...baseConfig.masking,
      auditSensitiveAccess: features.enableSecurityAuditing
    },
    
    // Feature-specific loggers
    featureLoggers: {
      performance: features.enablePerformanceLogging,
      security: features.enableSecurityAuditing,
      business: features.enableBusinessEventLogging,
      tracing: features.enableRequestTracing
    }
  };
};
```

## Testing Integration

```typescript
// test-utils/logger.test-setup.ts
import { Logger } from '@vytches-ddd/logging';

export const setupTestLogging = () => {
  // Quiet logging during tests
  Logger.configure({
    level: 'error', // Only show errors
    enableConsoleOutput: false,
    enableFileOutput: false,
    masking: { enabled: false } // Easier debugging in tests
  });
};

// test/user.service.spec.ts
import { setupTestLogging } from '../test-utils/logger.test-setup';
import { UserService } from '../src/user.service';

describe('UserService', () => {
  beforeAll(() => {
    setupTestLogging();
  });

  it('should create user with logging', async () => {
    const userService = new UserService();
    
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com',
      role: 'user'
    });

    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

## Best Practices Summary

### ✅ Do's

1. **Initialize logging early** in application startup
2. **Use Logger.forContext()** in classes for automatic context detection
3. **Configure data masking** before deploying to production
4. **Use appropriate log levels** for different types of information
5. **Include relevant context** in log entries (user IDs, operation names)
6. **Log both successful operations and failures**
7. **Set up global error handling** with logging
8. **Use structured logging** with objects rather than string concatenation

### ❌ Don'ts

1. **Don't log sensitive data** without proper masking
2. **Don't use debug level** in production without filtering
3. **Don't create logger instances** in hot paths
4. **Don't ignore performance impact** of logging
5. **Don't log the same event** at multiple levels
6. **Don't use synchronous logging** in high-throughput scenarios
7. **Don't forget to configure** environment-specific settings

## Troubleshooting

### Common Issues

1. **Context not detected**: Ensure stackTraceAnalysis is enabled
2. **Performance issues**: Check log level configuration and reduce debug logging
3. **Sensitive data leaked**: Review masking configuration and add missing keys
4. **Missing logs**: Verify logger initialization and level configuration
5. **Too many logs**: Adjust log levels and use conditional logging

### Performance Optimization

```typescript
// Conditional logging to avoid expensive operations
if (this.logger.isLevelEnabled('debug')) {
  this.logger.debug('Expensive debug info', {
    data: expensiveOperationToGenerateDebugData()
  });
}

// Use lazy evaluation for expensive log data
this.logger.info('Operation completed', () => ({
  results: generateExpensiveResults(),
  metrics: calculateMetrics()
}));
```

## Related Examples

- [Basic Logger Setup](./example-1.md)
- [CQRS Integration Logging](./example-2.md)
- [Result Pattern Logging](./example-3.md)
- [Common Logging Use Cases](./use-case.md)