# CQRS Package - Package Overview

**Version**: 1.0.0  
**Package**: @vytches-ddd/cqrs  
**Domain**: Architecture  
**Patterns**: command-query-responsibility-segregation, mediator-pattern,
handler-registration

## Package Philosophy

The CQRS package implements Command Query Responsibility Segregation with a
**MediatR-inspired architecture** that separates write operations (commands)
from read operations (queries). It provides automatic handler registration,
middleware pipeline, and performance monitoring capabilities.

## Core Principles

### 1. **Clear Separation of Concerns**

Commands modify state, queries retrieve data - never both in the same operation.

```typescript
// Commands change state
const result = await commandBus.execute(new CreateUserCommand(userData));

// Queries retrieve data
const user = await queryBus.execute(new GetUserByIdQuery(userId));
```

### 2. **Automatic Handler Registration**

Handlers are automatically discovered and registered through decorators and
dependency injection.

### 3. **Middleware Pipeline**

Cross-cutting concerns like validation, logging, and performance monitoring
applied transparently.

### 4. **Type Safety**

Full TypeScript support with compile-time validation of command/query to handler
mappings.

## Key Benefits

- **🎯 Clear Separation**: Commands and queries have distinct responsibilities
  and optimized implementations
- **🔄 Automatic Registration**: Handler discovery through decorators eliminates
  manual configuration
- **⚡ High Performance**: Optimized execution paths with minimal overhead and
  caching support
- **🛡️ Middleware Support**: Cross-cutting concerns applied consistently across
  all operations
- **📊 Built-in Monitoring**: Performance metrics, execution timing, and error
  tracking
- **🎨 Decorator-Based**: Clean, declarative handler configuration with rich
  metadata

## When to Use

✅ **Perfect for:**

- Complex business applications with distinct read/write patterns
- Systems requiring different optimization strategies for reads vs writes
- Applications needing comprehensive audit trails and command validation
- Scenarios where read models differ significantly from write models
- Integration with event sourcing and projection systems

❌ **Not suitable for:**

- Simple CRUD applications without complex business logic
- Real-time systems where command/query separation adds latency
- Applications with tightly coupled read/write operations
- Systems prioritizing simplicity over architectural benefits

## Architecture Components

### **CommandBus**

Executes commands that modify application state with validation, authorization,
and business rule enforcement.

### **QueryBus**

Handles queries that retrieve data with caching, filtering, and performance
optimization.

### **Handler Registration**

Automatic discovery and registration of command and query handlers through
`@CommandHandler` and `@QueryHandler` decorators.

### **Middleware Pipeline**

Extensible pipeline for cross-cutting concerns like validation, logging,
metrics, caching, and error handling.

### **Performance Monitoring**

Built-in metrics collection for execution timing, success rates, and system
health monitoring.

## Integration Patterns

The package integrates seamlessly with other @vytches-ddd packages:

- **@vytches-ddd/di**: Automatic handler discovery and dependency injection
- **@vytches-ddd/events**: Command results can trigger domain events
  automatically
- **@vytches-ddd/validation**: Command validation through middleware pipeline
- **@vytches-ddd/logging**: Comprehensive logging with `@LogCommands` and
  `@LogQueries` decorators
- **@vytches-ddd/resilience**: Circuit breaker and retry patterns for external
  dependencies

## Performance Characteristics

- **Fast Handler Resolution**: O(1) lookup time for command/query to handler
  mapping
- **Minimal Overhead**: Direct handler invocation with optional middleware
- **Caching Support**: Query result caching with configurable TTL and
  invalidation
- **Concurrent Execution**: Thread-safe execution with async/await support
- **Memory Efficient**: Lazy handler instantiation and garbage collection
  friendly

## Common Use Cases

1. **User Management**: CreateUser commands vs GetUser queries with different
   data models
2. **Order Processing**: Order commands modify state, order queries provide
   optimized read views
3. **Reporting Systems**: Complex queries with aggregations and caching for
   dashboards
4. **API Gateway Integration**: Commands for mutations, queries for data
   retrieval
5. **Event Sourcing**: Commands generate events, queries read from projections

## CQRS vs Traditional Patterns

### **Traditional Service Pattern**

```typescript
// Mixed responsibilities
class UserService {
  async createUser(data: UserData): Promise<User> {} // Command
  async getUser(id: string): Promise<User> {} // Query
  async updateUser(id: string, data: UserData): Promise<User> {} // Command
}
```

### **CQRS Pattern**

```typescript
// Clear separation
class CreateUserCommandHandler {
  async handle(command: CreateUserCommand): Promise<void> {}
}

class GetUserQueryHandler {
  async handle(query: GetUserQuery): Promise<User> {}
}
```

## Getting Started

The package follows a **library-first approach** - focus on understanding the
core CQRS patterns before exploring framework-specific integrations.

1. **Start with Commands**: Create command handlers for state-changing
   operations
2. **Add Queries**: Implement query handlers for data retrieval with different
   optimizations
3. **Explore Middleware**: Add validation, logging, and monitoring through
   middleware
4. **Framework Integration**: NestJS, Express integration patterns for
   production use
5. **Advanced Features**: Caching, event integration, and performance
   optimization

## Design Philosophy

- **Explicit over Implicit**: Clear command/query intention rather than mixed
  operations
- **Performance Oriented**: Separate optimization strategies for reads and
  writes
- **Developer Experience**: Minimal boilerplate with maximum type safety
- **Enterprise Ready**: Built-in monitoring, logging, and error handling
- **Framework Agnostic**: Core patterns work with any web framework or hosting
  environment
