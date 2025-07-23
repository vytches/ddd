# Unified Event System - Package Overview

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Domain**: Architecture  
**Patterns**: event-driven-architecture, domain-events, integration-events,
repository-pattern

## Package Philosophy

The Unified Event System provides a consolidated event handling architecture
that eliminates the complexity of managing multiple event buses. It follows the
**"Repository Pattern with Automatic Event Publishing"** philosophy, where
events are automatically published when aggregates are saved through
repositories.

## Core Principles

### 1. **Repository-Driven Event Publishing**

Events are published automatically when aggregates are persisted, ensuring
consistency between state changes and event emission.

```typescript
// Events are published automatically during save
await orderRepository.save(orderAggregate);
// ↳ Automatically publishes: OrderCreated, InventoryReserved, etc.
```

### 2. **Unified Event Bus Architecture**

Single event bus handles all event types (domain, integration, audit) with smart
routing and context filtering.

### 3. **Transaction Safety**

Events are persisted alongside aggregate state changes, ensuring atomicity and
consistency.

### 4. **Context-Aware Processing**

Events can be filtered and routed based on context (user, tenant, bounded
context) for multi-tenant scenarios.

## Key Benefits

- **🎯 Simplified Architecture**: One event bus instead of multiple specialized
  buses
- **🔄 Automatic Publishing**: Repository pattern handles event publishing
  transparently
- **⚡ High Performance**: Optimized batch processing and concurrent event
  handling
- **🛡️ Transaction Safe**: ACID compliance with event persistence
- **🎨 Context Aware**: Smart routing based on context and correlation
- **📊 Observable**: Built-in metrics and monitoring capabilities

## When to Use

✅ **Perfect for:**

- Domain-driven applications requiring reliable event handling
- Systems needing automatic event publishing with state changes
- Multi-tenant applications with context-based event routing
- Applications requiring event sourcing capabilities
- Integration scenarios between bounded contexts

❌ **Not suitable for:**

- Simple CRUD applications without business logic
- Applications where eventual consistency is problematic
- Systems requiring synchronous-only processing
- Low-latency, high-frequency trading systems

## Architecture Components

### **UnifiedEventBus**

Central event bus that handles all event types with smart routing and batching
capabilities.

### **UniversalEventDispatcher**

Enhanced dispatcher with middleware pipeline for cross-cutting concerns like
logging and metrics.

### **Repository Integration**

Seamless integration with `IBaseRepository.save()` for automatic event
publishing during aggregate persistence.

### **Event Handlers**

Decorated event handlers with context filtering and automatic registration
through dependency injection.

## Integration Patterns

The package integrates seamlessly with other @vytches-ddd packages:

- **@vytches-ddd/repositories**: Automatic event publishing during save
  operations
- **@vytches-ddd/aggregates**: Event collection and management within aggregates
- **@vytches-ddd/di**: Automatic handler discovery and registration
- **@vytches-ddd/event-store**: Event persistence for event sourcing scenarios
- **@vytches-ddd/projections**: Read model updates from domain events

## Performance Characteristics

- **Concurrent Processing**: Events processed in parallel with configurable
  concurrency limits
- **Batch Operations**: `publishMany()` for efficient bulk event publishing
- **Memory Efficient**: Event streaming for large event volumes
- **Optimized Routing**: Context-based filtering reduces unnecessary processing

## Common Use Cases

1. **Order Processing Pipeline**: OrderCreated → PaymentRequested →
   InventoryReserved → OrderConfirmed
2. **User Registration Flow**: UserRegistered → WelcomeEmailSent →
   AccountActivated
3. **Inventory Management**: ProductSold → StockUpdated → ReorderTriggered
4. **Audit Trail Generation**: All domain events automatically generate audit
   events
5. **Integration Events**: Domain events transformed to integration events for
   external systems

## Getting Started

The package follows a **library-first approach** - focus on understanding the
core event publishing patterns before exploring framework-specific integrations.

1. **Start with Repository Pattern**: Understand automatic event publishing
   through repositories
2. **Learn Event Handlers**: Create context-aware event handlers with decorators
3. **Explore Advanced Features**: Batch processing, context filtering, and event
   sourcing
4. **Framework Integration**: NestJS, Express integration patterns for
   production use
