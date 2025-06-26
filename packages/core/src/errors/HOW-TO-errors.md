# Error Handling in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Error Handling System
- **Category**: Core Infrastructure
- **Purpose**: Structured error handling for domain, application, and framework layers
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What is the Error Handling System?

DomainTS provides a hierarchical error handling system that distinguishes between domain, application, and framework errors. It offers structured error classes with specific error codes and metadata support.

**Core Concept**:
```typescript
// Domain errors carry specific context and codes
throw MissingValueError.withValue('email', { 
  domain: 'user',
  code: DomainErrorCode.MissingValue 
});
```

## Core Components

### 1. BaseError

Foundation for all error types:

```typescript
abstract class BaseError extends Error {
  constructor(message: string);
  // Captures proper stack trace and sets error name
}
```

### 2. IDomainError

Abstract base for domain-specific errors:

```typescript
abstract class IDomainError extends BaseError {
  domain?: string | any;        // Domain context
  code: DomainErrorCode;        // Specific error code
  data?: unknown;               // Additional error data
  timestamp?: Date;             // When error occurred
  error?: Error;                // Original error if wrapped
}
```

### 3. Concrete Domain Errors

Pre-defined domain error types with factory methods:

- **MissingValueError**: When required values are missing
- **InvalidParameterError**: When parameters don't meet requirements
- **DuplicateError**: When uniqueness constraints are violated
- **NotFoundError**: When entities cannot be found

### 4. Error Code Enums

Three categories of error codes:

- **DomainErrorCode**: Domain layer errors (D_* prefix)
- **ApplicationErrorCode**: Application layer errors (A_* prefix)
- **FrameworkErrorCode**: Framework/infrastructure errors (F_* prefix)

## Usage Patterns

### Creating Domain Errors

```typescript
// Missing value with context
throw MissingValueError.withValue('customer email', {
  domain: 'order',
  data: { orderId: '123' }
});

// Invalid parameter with details
throw InvalidParameterError.withParameter('age', 'Age must be positive', {
  domain: 'customer',
  data: { providedValue: -5 }
});

// Duplicate entity
throw DuplicateError.withEntityId('user-123', {
  domain: 'user',
  data: { email: 'duplicate@example.com' }
});
```

### Error Structure

Each domain error includes:
- **message**: Human-readable error description
- **code**: Enum value for programmatic handling
- **domain**: Context where error occurred
- **data**: Additional error-specific information
- **timestamp**: When error was created
- **error**: Original error if this wraps another error

## Error Code Categories

### Domain Error Codes (D_*)
- Basic validation and business rule violations
- Entity-specific errors (not found, duplicate)
- Data format and parameter errors

### Application Error Codes (A_*)
- Service-level errors
- Permission and authorization failures
- External system integration errors

### Framework Error Codes (F_*)
- Infrastructure and configuration errors
- Security and rate limiting
- Service availability issues

## Best Practices

1. **Use Factory Methods**: Prefer static factory methods over direct instantiation
2. **Provide Context**: Always include relevant domain and data information
3. **Choose Appropriate Codes**: Use specific error codes for better error handling
4. **Wrap External Errors**: Use the `error` property to preserve original errors

## Integration with DomainTS

The error system integrates with:
- **Result Pattern**: Errors can be wrapped in Result.fail()
- **Validation**: Validation errors extend these base error types
- **Domain Services**: Services throw domain-specific errors
- **Repositories**: Data access errors use appropriate error types

## Conclusion

DomainTS error handling provides:
- **Structured Errors**: Consistent error format across the system
- **Contextual Information**: Rich metadata for debugging
- **Layer Separation**: Different error types for different architectural layers
- **Type Safety**: Full TypeScript support with enums and interfaces

This system enables precise error handling and reporting throughout your domain-driven application.
