# GetId Method Examples - AggregateRoot.getId

**Version**: 1.0.0  
**Package**: @vytches/ddd-aggregates  
**Complexity**: Basic  
**Domain**: Foundation  
**Patterns**: Identity Access, Entity ID Management  
**Dependencies**: @vytches/ddd-contracts, @vytches/ddd-value-objects  

## Description

Examples demonstrating AggregateRoot.getId() method for retrieving aggregate identity.

## Business Context

Every aggregate has a unique identity that remains constant throughout its lifecycle. The getId() method provides access to this identity.

## Domain Layer Example (Pure Business Logic)

@extract: getId:domain:basic
```typescript
const user = UserAggregate.create(userData);
const userId = user.getId();
return userId.getValue(); // string value
```
@extract-end

## Service Layer Example (Application Orchestration)

@extract: getId:service:basic
```typescript
const aggregate = await this.repository.findById(id);
if (aggregate.getId().equals(expectedId)) {
  return await this.processAggregate(aggregate);
}
throw new Error('Aggregate not found');
```
@extract-end

## Integration Layer Example (Infrastructure Concerns)

@extract: getId:integration:basic
```typescript
const aggregate = await this.repository.findById(aggregateId);
const id = aggregate.getId();
await this.cache.set(id.getValue(), aggregate.toSnapshot());
await this.auditLog.log(`Aggregate ${id.getValue()} accessed`);
return aggregate;
```
@extract-end

## Key Features

- **Identity Access**: Returns EntityId instance
- **Immutable Identity**: ID never changes after creation
- **Type Safety**: Strongly typed EntityId<T>
- **Value Comparison**: Use equals() for comparison

## Common Pitfalls

- Don't compare IDs with === directly
- Use getId().equals() for identity comparison
- Remember getId() returns EntityId, not raw value

## Related Examples

- [create.md](./create.md) - Aggregate creation
- [getVersion.md](./getVersion.md) - Version management