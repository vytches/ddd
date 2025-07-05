# @vytches-ddd/logging

Domain-Driven Design logging utilities with smart context detection, structured
logging, and seamless ecosystem integration.

## Features

- 🎯 **DDD-First Design** - Built specifically for Domain-Driven Design patterns
- 🔍 **Smart Context Detection** - Automatically detects bounded context, class
  names, and method names
- 📊 **Structured Logging** - JSON-based logging with metadata support
- 🔐 **Data Masking** - Automatic PII and sensitive data masking
- 🔄 **CQRS Integration** - Decorators and middleware for commands and queries
- 📦 **Result Pattern Integration** - Seamless integration with
  @vytches-ddd/utils Result pattern
- 🎨 **Pluggable Providers** - Easy integration with Winston, Pino, or custom
  loggers
- 🚀 **Zero Configuration** - Works out of the box with sensible defaults

## Quick Start

### Basic Usage

```typescript
import { Logger } from '@vytches-ddd/logging';

// Zero configuration - automatically detects context
const logger = Logger.create();
logger.info('Application started');

// Explicit context
const userLogger = Logger.forContext('UserService');
userLogger.info('User operation completed', { userId: '123' });
```

### Smart Context Detection

```typescript
class UserService {
  private logger = Logger.forContext(); // Automatically detects "UserService"

  async registerUser(user: User) {
    this.logger.info('Registering user', { email: user.email });
    // Output: [UserManagement] [UserService] Registering user { email: "[MASKED]" }
  }
}
```

### CQRS Integration

```typescript
import { LogCommands } from '@vytches-ddd/logging/integration';

@LogCommands({ includePayload: true, logLevel: 'debug' })
class CreateUserCommandHandler {
  async handle(command: CreateUserCommand): Promise<Result<User>> {
    // Automatic logging of command execution, timing, success/failure
    return Result.ok(new User(command.email));
  }
}
```

### Result Pattern Integration

```typescript
import { ResultLoggingExtensions } from '@vytches-ddd/logging/integration';

const result = await userService
  .createUser(userData)
  .then(result =>
    ResultLoggingExtensions.tapLog(result, 'User creation completed', {
      includeValue: true,
    })
  )
  .then(result =>
    ResultLoggingExtensions.tapLogError(result, 'User creation failed')
  );
```

## Configuration

### Global Configuration

```typescript
import { Logger, ConsoleProvider } from '@vytches-ddd/logging';

Logger.configure({
  level: 'debug',
  provider: 'console', // or custom provider
  contextDetection: {
    enabled: true,
    includeStackTrace: false,
  },
  formatting: {
    colorize: true,
    prettyPrint: true,
    timestamp: true,
  },
  masking: {
    enabled: true,
    patterns: [/custom-pattern/g],
    replacement: '[REDACTED]',
  },
});
```

### Custom Providers

The library uses a simple `LogProvider` interface that's easy to implement:

```typescript
export interface LogProvider {
  readonly name: string;
  write(event: LogEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}
```

## Custom Provider Examples

### Winston Adapter

```typescript
import winston from 'winston';
import type { LogProvider, LogEvent } from '@vytches-ddd/logging';

class WinstonAdapter implements LogProvider {
  readonly name = 'winston';

  constructor(private winston: winston.Logger) {}

  write(event: LogEvent): void {
    const meta = {
      timestamp: event.timestamp,
      context: event.context,
      logId: event.id,
      ...(event.data && { data: event.data }),
      ...(event.error && {
        error: {
          name: event.error.name,
          message: event.error.message,
          stack: event.error.stack,
        },
      }),
      ...(event.tags && { tags: event.tags }),
    };

    this.winston.log(event.level, event.message, meta);
  }
}

// Usage
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

Logger.configure({
  provider: new WinstonAdapter(winstonLogger),
});
```

### Pino Adapter

```typescript
import pino from 'pino';
import type { LogProvider, LogEvent } from '@vytches-ddd/logging';

class PinoAdapter implements LogProvider {
  readonly name = 'pino';

  constructor(private pino: pino.Logger) {}

  write(event: LogEvent): void {
    const obj = {
      logId: event.id,
      context: event.context,
      ...(event.data && { data: event.data }),
      ...(event.error && { err: event.error }),
      ...(event.tags && { tags: event.tags }),
    };

    this.pino[event.level](obj, event.message);
  }
}

// Usage
const pinoLogger = pino({ level: 'info' });

Logger.configure({
  provider: new PinoAdapter(pinoLogger),
});
```

### HTTP/REST API Adapter

```typescript
import type { LogProvider, LogEvent } from '@vytches-ddd/logging';

class HttpLogProvider implements LogProvider {
  readonly name = 'http';

  constructor(
    private endpoint: string,
    private options: { batchSize?: number; flushInterval?: number } = {}
  ) {
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.setupBatching();
  }

  private batch: LogEvent[] = [];
  private timer?: NodeJS.Timeout;

  write(event: LogEvent): void {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const logsToSend = [...this.batch];
    this.batch = [];

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      console.error('Failed to send logs to HTTP endpoint:', error);
      // Could implement retry logic here
    }
  }

  private setupBatching(): void {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.flush();
  }
}

// Usage
Logger.configure({
  provider: new HttpLogProvider('https://api.example.com/logs', {
    batchSize: 50,
    flushInterval: 10000,
  }),
});
```

### File System Adapter

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { LogProvider, LogEvent } from '@vytches-ddd/logging';

class FileLogProvider implements LogProvider {
  readonly name = 'file';

  constructor(
    private logPath: string,
    private options: {
      maxFileSize?: number;
      maxFiles?: number;
      rotateDaily?: boolean;
    } = {}
  ) {
    this.ensureLogDirectory();
  }

  async write(event: LogEvent): Promise<void> {
    const logLine =
      JSON.stringify({
        timestamp: event.timestamp.toISOString(),
        level: event.level,
        message: event.message,
        context: event.context,
        ...(event.data && { data: event.data }),
        ...(event.error && {
          error: {
            name: event.error.name,
            message: event.error.message,
            stack: event.error.stack,
          },
        }),
        ...(event.tags && { tags: event.tags }),
      }) + '\n';

    const filePath = this.getCurrentLogFile();

    try {
      await fs.appendFile(filePath, logLine);
      await this.checkRotation(filePath);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    const dir = path.dirname(this.logPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getCurrentLogFile(): string {
    if (this.options.rotateDaily) {
      const date = new Date().toISOString().split('T')[0];
      const ext = path.extname(this.logPath);
      const base = path.basename(this.logPath, ext);
      const dir = path.dirname(this.logPath);
      return path.join(dir, `${base}-${date}${ext}`);
    }
    return this.logPath;
  }

  private async checkRotation(filePath: string): Promise<void> {
    const maxSize = this.options.maxFileSize || 10 * 1024 * 1024; // 10MB

    try {
      const stats = await fs.stat(filePath);
      if (stats.size > maxSize) {
        await this.rotateFile(filePath);
      }
    } catch (error) {
      // File might not exist yet
    }
  }

  private async rotateFile(filePath: string): Promise<void> {
    const maxFiles = this.options.maxFiles || 5;

    // Rotate existing files
    for (let i = maxFiles - 1; i >= 1; i--) {
      const oldFile = `${filePath}.${i}`;
      const newFile = `${filePath}.${i + 1}`;

      try {
        await fs.rename(oldFile, newFile);
      } catch (error) {
        // File might not exist
      }
    }

    // Move current file to .1
    try {
      await fs.rename(filePath, `${filePath}.1`);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }
}

// Usage
Logger.configure({
  provider: new FileLogProvider('/var/log/app/application.log', {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    rotateDaily: true,
  }),
});
```

## Advanced Usage

### Bounded Context Specific Logging

```typescript
// Different log levels and providers per bounded context
Logger.configure({
  provider: 'console', // Default
});

// Override for specific context
const paymentLogger = Logger.forContext('PaymentService').withContext({
  boundedContext: 'PaymentProcessing',
  tenantId: 'tenant-123',
});
```

### Correlation and Tracing

```typescript
// Request correlation
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateId();
  res.locals.logger = Logger.create()
    .withCorrelationId(correlationId)
    .withUserId(req.user?.id)
    .withTenantId(req.tenant?.id);
  next();
});

// Usage in handlers
const logger = res.locals.logger.child('OrderHandler');
logger.info('Processing order', { orderId });
```

### Custom Data Masking

```typescript
Logger.configure({
  masking: {
    enabled: true,
    patterns: [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit cards
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
      /\bpassword["\']?\s*[:=]\s*["\']?[^\s,"'}]+/gi, // Passwords
    ],
    sensitiveKeys: [
      'password',
      'passwd',
      'secret',
      'token',
      'key',
      'authorization',
      'auth',
      'email',
      'phone',
      'ssn',
      'credit',
      'card',
      'pin',
      'cvv',
      'personalId',
      'creditCard', // Add your domain-specific keys
    ],
    replacement: '[MASKED]',
  },
});
```

## Integration with Observability

The logging system is designed to work seamlessly with the existing
observability infrastructure in `@vytches-ddd/resilience`:

```typescript
import { Logger } from '@vytches-ddd/logging';
import { CircuitBreaker } from '@vytches-ddd/resilience';

// Circuit breaker with enhanced logging
@LogStateChanges({ logLevel: 'info' })
class EnhancedCircuitBreaker extends CircuitBreaker {
  // Automatic state change logging
}
```

## TypeScript Support

Full TypeScript support with strict typing:

```typescript
interface UserCreatedEvent {
  userId: string;
  email: string;
  createdAt: Date;
}

const logger = Logger.forContext('UserService');

// Type-safe logging
logger.info('User created', {
  userId: user.id,
  eventType: 'UserCreated',
  timestamp: new Date(),
} satisfies Partial<UserCreatedEvent>);
```

## Best Practices

1. **Use Context Detection**: Let the logger automatically detect context when
   possible
2. **Structured Data**: Always use the data parameter for structured information
3. **Sensitive Data**: Configure masking patterns for your domain
4. **Correlation IDs**: Use correlation tracking for request tracing
5. **Bounded Context**: Set bounded context for better log organization
6. **Error Logging**: Always include the error object when logging errors
7. **Performance**: Use appropriate log levels (avoid debug in production)

## Examples

See the `/examples` directory for complete implementation examples and usage
patterns.
