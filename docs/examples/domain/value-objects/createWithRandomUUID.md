# EntityId createWithRandomUUID - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects
**Complexity**: basic **Domain**: value-objects
**Patterns**: [id-generation, uuid] **Dependencies**: [LibUtils]

## Description

Shows how to create a new EntityId with a randomly generated UUID value.

## Business Context

Used when creating new entities that need unique identifiers, commonly in domain services and repositories.

## Code Example

@extract: createWithRandomUUID:domain:basic
```typescript
const entityId = EntityId.createWithRandomUUID();
const idValue = entityId.getValue();
```
@extract-end

@extract: createWithRandomUUID:service:basic
```typescript
const createUser = (userData: UserData) => {
  const userId = EntityId.createWithRandomUUID();
  return User.create({ id: userId, ...userData });
};
```
@extract-end

@extract: createWithRandomUUID:integration:basic
```typescript
const userRepository = new UserRepository();
const newUser = await userRepository.create({
  id: EntityId.createWithRandomUUID(),
  name: 'John Doe',
  email: 'john@example.com'
});
```
@extract-end

## Key Features

- Generates cryptographically secure UUID v4 identifiers
- Returns typed EntityId with UUID validation
- Ensures uniqueness across distributed systems

## Common Pitfalls

- Don't use for deterministic testing without mocking
- Remember that UUIDs are strings, not numbers

## Related Examples

- [fromUUID example](./fromUUID.md)
- [fromText example](./fromText.md)