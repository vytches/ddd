# AggregateError - Advanced Example

**Version**: 1.0.0
**Package**: @vytches/ddd-aggregates
**Complexity**: intermediate
**Domain**: aggregates
**Patterns**: error-handling, domain-errors, factory-methods
**Dependencies**: @vytches/ddd-domain-primitives

## Description

Demonstrates comprehensive error handling for aggregate operations using domain-specific error types. Shows factory methods for creating contextual errors with rich metadata.

## Business Context

Proper error handling is crucial for enterprise aggregates. AggregateError provides specific error types for common aggregate scenarios like version conflicts, missing capabilities, and configuration issues.

## Code Example

```typescript
import { AggregateError } from '@vytches/ddd-aggregates';
import { AggregateBuilder } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

// Handle version conflicts during aggregate updates
function handleVersionConflict() {
  try {
    // Simulate version conflict during save
    const error = AggregateError.versionConflict(
      'OrderAggregate',
      'order-123',
      5, // current version
      3  // expected version
    );
    
    throw error;
  } catch (error) {
    if (error instanceof AggregateError) {
      console.log('Version conflict detected:', {
        code: error.code,
        message: error.message,
        data: error.data // Contains aggregateType, aggregateId, versions
      });
      
      // Handle optimistic concurrency conflict
      // Could refresh aggregate and retry operation
    }
  }
}

// Handle missing capabilities
function handleMissingCapability() {
  try {
    const aggregate = AggregateBuilder
      .create({ id: new EntityId('order-123', 'text') })
      .build(); // No snapshot capability added
    
    // Try to use snapshot functionality
    if (!aggregate.hasCapability(SnapshotCapability)) {
      throw AggregateError.featureNotEnabled('snapshot');
    }
  } catch (error) {
    if (error instanceof AggregateError) {
      console.log('Feature not available:', {
        feature: error.data?.feature,
        suggestion: 'Add capability using AggregateBuilder.withSnapshots()'
      });
    }
  }
}

// Handle snapshot validation errors
function handleSnapshotErrors() {
  try {
    // Invalid snapshot structure
    const invalidSnapshot = {
      id: 'wrong-id',
      aggregateType: 'DifferentType',
      // Missing required fields
    };
    
    const error = AggregateError.invalidSnapshot(
      'OrderAggregate',
      'Missing required snapshot fields'
    );
    
    throw error;
  } catch (error) {
    if (error instanceof AggregateError) {
      console.log('Snapshot validation failed:', {
        aggregateType: error.data?.aggregateType,
        reason: error.data?.reason,
        code: error.code
      });
    }
  }
}

// Handle configuration errors
function handleConfigurationErrors() {
  try {
    // Event store not configured for event sourcing
    throw AggregateError.eventStoreNotConfigured({
      context: 'Trying to save aggregate with event sourcing capability'
    });
  } catch (error) {
    if (error instanceof AggregateError) {
      console.log('Configuration error:', {
        message: error.message,
        context: error.data?.context,
        solution: 'Configure event store before using event sourcing'
      });
    }
  }
}

// Handle ID and type mismatches
function handleMismatchErrors() {
  try {
    // ID mismatch during snapshot restoration
    const snapshotId = 'snapshot-for-order-456';
    const aggregateId = 'order-123';
    
    throw AggregateError.idMismatch(snapshotId, aggregateId);
  } catch (error) {
    if (error instanceof AggregateError) {
      console.log('ID mismatch:', {
        snapshotId: error.data?.snapshotId,
        aggregateId: error.data?.aggregateId,
        resolution: 'Ensure snapshot belongs to correct aggregate'
      });
    }
  }
}

// Comprehensive error handling in aggregate operations
async function safeAggregateOperation() {
  try {
    const aggregate = AggregateBuilder
      .create({ id: new EntityId('order-123', 'text') })
      .withSnapshots()
      .withEventSourcing()
      .build();
    
    // Simulate operation that could fail
    await aggregate.getCapability(EventSourcingCapability)?.saveToEventStore();
    
  } catch (error) {
    if (error instanceof AggregateError) {
      // Handle specific aggregate errors
      switch (error.code) {
        case 'VALIDATION_FAILED':
          console.log('Validation error:', error.message);
          break;
        case 'MISSING_VALUE':
          console.log('Missing configuration:', error.message);
          break;
        case 'INVALID_FORMAT':
          console.log('Invalid data format:', error.message);
          break;
        default:
          console.log('Aggregate error:', error.message);
      }
      
      // Error data contains contextual information
      console.log('Error context:', error.data);
    } else {
      // Handle other types of errors
      console.log('Unexpected error:', error);
    }
  }
}
```

## Key Features

- **Rich Error Context**: Factory methods include relevant metadata
- **Domain-Specific Errors**: Specific error types for aggregate scenarios
- **Structured Error Data**: Consistent error data format for programmatic handling
- **Error Categorization**: Using domain error codes for classification
- **Debugging Support**: Detailed error messages with context

## Common Pitfalls

- Always check error type before accessing specific data properties
- Use factory methods instead of creating AggregateError directly
- Include sufficient context in error data for debugging
- Handle version conflicts gracefully with retry logic

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Basic aggregate implementation
- [AggregateBuilder](./aggregate-builder.md) - Builder pattern for aggregates
