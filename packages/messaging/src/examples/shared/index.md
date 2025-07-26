# Messaging Package - Shared Resources

**Package**: @vytches/ddd-messaging  
**Purpose**: Common utilities, patterns, and documentation for messaging
examples

## Shared Components

### Common Types

All messaging examples use standardized types from `./types/index.ts`:

- **Order**: E-commerce order entity
- **PaymentDetails**: Payment processing data
- **NotificationRequest**: Multi-channel notifications
- **SagaState**: Saga execution state management

### Best Practices

1. **Outbox Pattern**: Always use within database transactions
2. **Retry Logic**: Implement exponential backoff for external services
3. **Dead Letter Queues**: Monitor and handle failed messages
4. **Saga Compensation**: Design idempotent compensating actions

### Integration Patterns

- **NestJS Manual Setup**: Full control over configuration
- **VytchesDDD DI**: Enterprise-grade dependency management
- **Event Integration**: Seamless integration with @vytches/ddd-events

## Quick Start

```typescript
import { OutboxMessageHandler } from '@vytches/ddd-messaging';
import { Order } from './types';

const handler = new OutboxMessageHandler(config);
await handler.storeMessages(messages, transaction);
```
