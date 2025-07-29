# DuplicateError withEntityId - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-primitives
**Complexity**: basic **Domain**: domain-primitives
**Patterns**: [error-creation, entity-validation] **Dependencies**: [DomainErrorOptions]

## Description

Shows how to create a DuplicateError when entity with specific ID already exists.

## Business Context

Used in repositories and services when attempting to create entities that already exist, preventing duplicate entries.

## Code Example

@extract: withEntityId:domain:basic
const error = DuplicateError.withEntityId('user-123');
throw error;
@extract-end

@extract: withEntityId:service:basic
const createUser = async (userData: UserData) => {
  const existingUser = await userRepository.findById(userData.id);
  if (existingUser) {
    throw DuplicateError.withEntityId(userData.id, { domain: 'User' });
  }
  return userRepository.save(userData);
};
@extract-end

@extract: withEntityId:integration:basic
const userRepository = new UserRepository();
try {
  await userRepository.create({ id: 'user-123', name: 'John' });
  await userRepository.create({ id: 'user-123', name: 'Jane' }); // Duplicate
} catch (error) {
  if (error instanceof DuplicateError) {
    logger.warn('Duplicate entity creation attempt:', error.message);
  }
}
@extract-end

## Key Features

- Creates specific duplicate entity errors with ID context
- Supports domain-specific error data
- Enables consistent duplicate handling across the application

## Common Pitfalls

- Always check for existing entities before creation
- Include relevant domain context in error data

## Related Examples

- [withValue example](./withValue.md)
- [withParameter example](./withParameter.md)