# 3. Implement Custom Enterprise Logging Instead of External Libraries

Date: 2025-07-05

## Status

2025-07-05 accepted

## Context

VytchesDDD requires comprehensive logging across all packages for debugging, monitoring, and enterprise observability. Initial considerations included popular logging libraries like Winston, Pino, or Bunyan.

### Domain-Driven Design Specific Requirements

1. **DDD-First Design**: Need automatic detection of bounded contexts, aggregates, and domain concepts
2. **Smart Context Detection**: Automatically extract class names, method names, and domain context from stack traces
3. **Data Masking**: Automatic PII and sensitive data masking with domain-aware patterns
4. **CQRS Integration**: First-class support for command/query logging with execution timing
5. **Aggregate State Tracking**: Specialized logging for aggregate state changes and domain events

### Enterprise Requirements

- **Zero Configuration**: Work out-of-the-box with sensible defaults
- **Structured Logging**: JSON-based with rich metadata and correlation tracking
- **Provider Agnostic**: Allow plugging into existing enterprise logging infrastructure
- **Bundle Impact**: Minimal bundle size impact for library consumers
- **Correlation Tracking**: Built-in support for request IDs, user IDs, tenant IDs

### External Library Evaluation

**Winston (2.6MB)**:
- ✅ Mature and stable
- ✅ Multiple transports
- ❌ Large bundle size
- ❌ No DDD-specific features
- ❌ Manual configuration required
- ❌ No automatic context detection

**Pino (900KB)**:
- ✅ High performance
- ✅ JSON logging
- ❌ Still significant bundle size
- ❌ No DDD patterns support
- ❌ Manual correlation tracking
- ❌ No data masking

**Bunyan (500KB)**:
- ✅ Structured logging
- ✅ Good serialization
- ❌ Bundle overhead
- ❌ No domain-specific features
- ❌ Limited TypeScript support

### Key Challenges with External Libraries

1. **Bundle Bloat**: All evaluated libraries add significant bundle size
2. **Configuration Complexity**: Require extensive setup for enterprise features
3. **Missing DDD Features**: None provide domain-specific logging patterns
4. **Dependency Risk**: External dependencies introduce maintenance and security concerns
5. **Customization Limits**: Difficult to extend with domain-specific functionality

## Decision

We will implement a **custom enterprise logging package** (`@vytches-ddd/logging`) with the following design:

### Core Architecture

1. **DDD-First Design**: Built specifically for Domain-Driven Design patterns
2. **Smart Context Detection**: Automatic extraction of domain context from stack traces
3. **Zero Dependencies**: Pure TypeScript implementation with no external runtime dependencies
4. **Pluggable Providers**: Easy integration with existing logging infrastructure
5. **Enterprise Features**: Built-in correlation tracking, data masking, and structured logging

### Key Features

```typescript
// Automatic context detection
class UserService {
  private logger = Logger.forContext(); // Auto-detects "UserService"
  
  @LogCommands({ includePayload: true })
  async createUser(command: CreateUserCommand) {
    // Automatic command logging with timing
  }
}

// Built-in data masking
logger.info('User created', { 
  email: 'user@example.com',  // Automatically masked
  password: 'secret123'       // Automatically masked
});

// Correlation tracking
const correlatedLogger = logger
  .withCorrelationId('req-123')
  .withUserId('user-456');
```

### Implementation Strategy

1. **Core Logger**: Lightweight logger with structured output
2. **Context Detection**: Stack trace analysis for automatic context
3. **Data Masking**: Configurable PII masking with sensible defaults
4. **CQRS Integration**: Decorators for command/query logging
5. **Provider Abstraction**: Console, Winston, Pino adapters
6. **Result Integration**: Extensions for Result pattern logging

### Provider Support

```typescript
// Console (built-in)
Logger.configure({ provider: new ConsoleProvider() });

// Winston integration
Logger.configure({ provider: new WinstonProvider(winstonLogger) });

// Pino integration  
Logger.configure({ provider: new PinoProvider(pinoLogger) });
```

## Consequences

### Positive Consequences

- **Perfect DDD Integration**: First-class support for domain concepts and patterns
- **Zero Bundle Impact**: Minimal size impact on consumer applications
- **Enterprise Ready**: Built-in correlation tracking, masking, and structured logging
- **Zero Configuration**: Works out-of-the-box with intelligent defaults
- **Provider Flexibility**: Easy integration with existing enterprise logging infrastructure
- **Type Safety**: Full TypeScript support with excellent IntelliSense
- **Performance**: Optimized for DDD patterns with minimal overhead
- **Maintenance Control**: No external dependency risks or security vulnerabilities

### Negative Consequences

- **Development Overhead**: Need to implement and maintain custom logging solution
- **Feature Parity**: May lack some advanced features of mature logging libraries
- **Community Support**: No existing community around the logging implementation
- **Testing Burden**: Need comprehensive testing of all logging functionality

### Neutral Consequences

- **Learning Curve**: Team needs to understand custom logging API
- **Documentation**: Need to document logging patterns and best practices
- **Provider Compatibility**: Need to ensure compatibility with major logging libraries

### Implementation Details

- **Smart Context Detection**: Automatic class/method name extraction from stack traces
- **Structured Output**: JSON-based logging with consistent metadata format
- **Data Masking**: Automatic detection and masking of sensitive data patterns
- **Decorator System**: `@LogCommands`, `@LogQueries`, `@LogStateChanges` decorators
- **Correlation Support**: Built-in correlation ID, user ID, tenant ID tracking
- **Performance Monitoring**: Execution timing and performance metrics collection

### Success Metrics

- ✅ Zero external dependencies achieved
- ✅ DDD-specific features fully implemented
- ✅ Automatic context detection working across all packages
- ✅ Data masking preventing PII leakage
- ✅ CQRS decorators providing automatic logging
- ✅ Enterprise correlation tracking implemented
- ✅ Provider abstraction allowing Winston/Pino integration
