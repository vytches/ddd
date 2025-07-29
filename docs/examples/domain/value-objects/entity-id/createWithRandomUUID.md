# EntityId.createWithRandomUUID() - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects  
**Complexity**: basic **Domain**: Core  
**Patterns**: Factory Method, Value Object **Dependencies**: @vytches/ddd-utils

## Description

Enhanced factory method with strict validation for creating UUID-based EntityId instances.

## Business Context

UUID-based identifiers are essential for distributed systems where unique identification across multiple services is required.

@extract: createWithRandomUUID:domain:basic
```typescript
// Generate new UUID-based EntityId
const userId = EntityId.createWithRandomUUID();
console.log(userId.getValue()); // "550e8400-e29b-41d4-a716-446655440000"
console.log(userId.getType()); // "uuid"
```
@extract-end

@extract: createWithRandomUUID:service:intermediate
```typescript
// Service layer usage with validation
const createUser = (userData: CreateUserData) => {
  const userId = EntityId.createWithRandomUUID();
  const user = new User({ id: userId, ...userData });
  return userRepository.save(user);
};
```
@extract-end

@extract: createWithRandomUUID:integration:advanced
```typescript
// Integration with external API requiring UUID
const integrateWithExternalAPI = async () => {
  const correlationId = EntityId.createWithRandomUUID();
  
  const response = await externalService.createResource({
    correlationId: correlationId.getValue(),
    data: payload
  });
  
  return { id: correlationId, result: response };
};
```
@extract-end

## Key Features

- Automatic UUID generation using crypto-secure methods
- Built-in validation for UUID format compliance
- Type-safe EntityId creation with proper typing

## Common Pitfalls

- Don't manually generate UUIDs - use the factory method for consistency
- Remember that UUIDs are strings, not objects - use getValue() for comparisons

## Related Examples

- [EntityId.fromUUID()](./fromUUID.md) - Create from existing UUID
- [EntityId.fromText()](./fromText.md) - Create from text identifier