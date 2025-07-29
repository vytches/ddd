# GetVersion Method Examples - AggregateRoot.getVersion

**Version**: 1.0.0  
**Package**: @vytches/ddd-aggregates  
**Complexity**: Basic  
**Domain**: Foundation  
**Patterns**: Version Management, Optimistic Locking  
**Dependencies**: @vytches/ddd-contracts  

## Description

Examples demonstrating AggregateRoot.getVersion() method for aggregate version management.

## Business Context

Aggregate versioning enables optimistic concurrency control and tracks the number of changes applied to the aggregate.

## Domain Layer Example (Pure Business Logic)

@extract: getVersion:domain:basic
```typescript
const user = UserAggregate.create(userData);
const initialVersion = user.getVersion(); // 0
user.updateName('New Name');
const currentVersion = user.getVersion(); // 1
```
@extract-end

## Service Layer Example (Application Orchestration)

@extract: getVersion:service:basic
```typescript
const aggregate = await this.repository.findById(id);
const expectedVersion = command.expectedVersion;
if (aggregate.getVersion() !== expectedVersion) {
  throw new ConcurrencyError('Version mismatch');
}
return await this.updateAggregate(aggregate, command);
```
@extract-end

## Integration Layer Example (Infrastructure Concerns)

@extract: getVersion:integration:basic
```typescript
const aggregate = await this.repository.findById(id);
const currentVersion = aggregate.getVersion();
await this.optimisticLock.verify(id, currentVersion);
await this.repository.save(aggregate);
await this.versionHistory.record(id, currentVersion + 1);
```
@extract-end

## Key Features

- **Optimistic Locking**: Prevents concurrent modification conflicts
- **Change Tracking**: Tracks number of modifications
- **Concurrency Control**: Enables safe concurrent operations
- **State Consistency**: Ensures aggregate state integrity

## Common Pitfalls

- Always check version before updates in concurrent systems
- Don't rely on version for business logic decisions
- Remember version starts at 0 for new aggregates

## Related Examples

- [create.md](./create.md) - Aggregate creation
- [commit.md](./commit.md) - Event commitment