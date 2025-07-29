# Commit Method Examples - AggregateRoot.commit

**Version**: 1.0.0  
**Package**: @vytches/ddd-aggregates  
**Complexity**: Basic  
**Domain**: Foundation  
**Patterns**: Event Lifecycle, Transaction Boundary  
**Dependencies**: @vytches/ddd-contracts  

## Description

Examples demonstrating AggregateRoot.commit() method for finalizing domain events after successful persistence.

## Business Context

The commit() method clears uncommitted domain events after they've been successfully published, completing the aggregate's transaction cycle.

## Domain Layer Example (Pure Business Logic)

@extract: commit:domain:basic
```typescript
const user = UserAggregate.create(userData);
const events = user.getDomainEvents(); // Has events
user.commit();
const afterCommit = user.getDomainEvents(); // Empty
```
@extract-end

## Service Layer Example (Application Orchestration)

@extract: commit:service:basic
```typescript
const aggregate = await this.repository.findById(id);
aggregate.updateStatus(newStatus);
await this.repository.save(aggregate);
await this.eventDispatcher.dispatch(aggregate.getDomainEvents());
aggregate.commit(); // Clear events after successful dispatch
```
@extract-end

## Integration Layer Example (Infrastructure Concerns)

@extract: commit:integration:basic
```typescript
const aggregate = await this.repository.findById(id);
const events = aggregate.getDomainEvents();
await this.eventStore.append(aggregate.getId(), events);
await this.eventBus.publishMany(events);
aggregate.commit(); // Mark events as committed
await this.repository.save(aggregate);
```
@extract-end

## Key Features

- **Event Cleanup**: Clears uncommitted domain events
- **Transaction Completion**: Marks successful event publishing
- **State Consistency**: Maintains clean aggregate state
- **Idempotent Operation**: Safe to call multiple times

## Common Pitfalls

- Only call commit() after successful event publishing
- Don't commit before events are persisted/published
- Remember commit() affects event state, not aggregate data

## Related Examples

- [create.md](./create.md) - Aggregate creation
- [getDomainEvents.md](./getDomainEvents.md) - Event access