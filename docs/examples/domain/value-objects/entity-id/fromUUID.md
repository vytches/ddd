# EntityId.fromUUID() - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects  
**Complexity**: intermediate **Domain**: Core  
**Patterns**: Factory Method, Validation **Dependencies**: @vytches/ddd-utils, @vytches/ddd-domain-primitives

## Description

Create EntityId from existing UUID string with built-in validation and error handling.

## Business Context

Converting external UUID strings to typed EntityId instances is common when integrating with databases, APIs, or user input that needs validation.

@extract: fromUUID:domain:basic
```typescript
// Create EntityId from existing UUID
const existingUuid = "550e8400-e29b-41d4-a716-446655440000";
const entityId = EntityId.fromUUID(existingUuid);
console.log(entityId.getValue()); // "550e8400-e29b-41d4-a716-446655440000"
```
@extract-end

@extract: fromUUID:service:intermediate
```typescript
// Service validation with error handling
const findUserById = (uuid: string) => {
  const userId = EntityId.fromUUID(uuid); // Validates format
  return userRepository.findById(userId);
};
```
@extract-end

@extract: fromUUID:integration:advanced
```typescript
// API request processing with validation
const processRequest = (req: Request) => {
  try {
    const resourceId = EntityId.fromUUID(req.params.id);
    return await resourceService.getResource(resourceId);
  } catch (error) {
    throw new ValidationError('Invalid resource ID format');
  }
};
```
@extract-end

## Key Features

- Strict UUID format validation using LibUtils
- Throws MissingValueError for null/undefined values
- Throws InvalidParameterError for malformed UUIDs
- Type-safe conversion to EntityId instance

## Common Pitfalls

- Always handle validation errors when processing user input
- Don't assume external UUIDs are valid - use fromUUID() for validation
- Check for null/undefined values before calling fromUUID()

## Related Examples

- [EntityId.createWithRandomUUID()](./createWithRandomUUID.md) - Generate new UUID
- [EntityId.fromText()](./fromText.md) - Create from text identifier