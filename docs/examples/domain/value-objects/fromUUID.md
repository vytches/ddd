# EntityId fromUUID - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects
**Complexity**: basic **Domain**: value-objects
**Patterns**: [id-creation, validation] **Dependencies**: [LibUtils, MissingValueError]

## Description

Shows how to create an EntityId from an existing UUID string with validation.

## Business Context

Used when reconstructing entities from persistent storage or external APIs that provide UUID identifiers.

## Code Example

@extract: fromUUID:domain:basic
```typescript
const entityId = EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000');
const isValid = entityId.validate(entityId.getValue());
```
@extract-end

@extract: fromUUID:service:basic
```typescript
const findUserById = async (uuidString: string) => {
  const userId = EntityId.fromUUID(uuidString);
  return await userRepository.findById(userId);
};
```
@extract-end

@extract: fromUUID:integration:basic
```typescript
const userController = new UserController();
const requestId = request.params.id;
try {
  const userId = EntityId.fromUUID(requestId);
  const user = await userService.getUserById(userId);
  return response.json(user);
} catch (error) {
  return response.status(400).json({ error: 'Invalid UUID format' });
}
```
@extract-end

## Key Features

- Validates UUID format before creating EntityId
- Throws descriptive errors for invalid inputs
- Supports standard UUID v4 format

## Common Pitfalls

- Always handle validation errors when parsing external UUIDs
- Don't assume all string IDs are valid UUIDs

## Related Examples

- [createWithRandomUUID example](./createWithRandomUUID.md)
- [fromText example](./fromText.md)