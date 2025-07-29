# Create Method Examples - AggregateBuilder.create

**Version**: 1.0.0  
**Package**: @vytches/ddd-aggregates  
**Complexity**: Basic  
**Domain**: Foundation  
**Patterns**: Aggregate Creation, Builder Pattern, Factory Method  
**Dependencies**: @vytches/ddd-domain-primitives, @vytches/ddd-value-objects  

## Description

Examples demonstrating AggregateBuilder.create() static factory method for proper aggregate initialization with capabilities.

## Business Context

AggregateBuilder provides a fluent interface for creating aggregates with different capabilities like versioning, snapshots, and event sourcing.

## Domain Layer Example (Pure Business Logic)

@extract: create:domain:basic
```typescript
const params = { id: 'user-123', version: 0 };
const builder = AggregateBuilder.create(params);
const user = builder.build(UserAggregate);
```
@extract-end

## Service Layer Example (Application Orchestration)

@extract: create:service:basic
```typescript
const command = new CreateUserCommand(userData);
const builder = AggregateBuilder.create({ id: command.userId });
const userAggregate = builder.withSnapshots().build(UserAggregate);
await this.userRepository.save(userAggregate);
```
@extract-end

## Integration Layer Example (Infrastructure Concerns)

@extract: create:integration:basic
```typescript
const builder = AggregateBuilder.create({ id: userId, version: 0 });
const aggregate = builder
  .withSnapshots()
  .withVersioning()
  .withEventSourcing(this.eventStore)
  .build(UserAggregate);
await this.repository.save(aggregate);
```
@extract-end

## Key Features

- **Factory Pattern**: Static factory method for construction
- **Fluent Interface**: Chainable builder methods  
- **Capability System**: Modular aggregate capabilities
- **Type Safety**: Generic type support for aggregate types

## Common Pitfalls

- Don't use `new AggregateBuilder()` - constructor is private
- Always use `AggregateBuilder.create()` static method
- Use appropriate capabilities for your use case

## Related Examples

- [getId.md](./getId.md) - Getting aggregate ID
- [getVersion.md](./getVersion.md) - Version management
- [commit.md](./commit.md) - Event commitment
