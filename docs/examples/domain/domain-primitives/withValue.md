# MissingValueError withValue - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-primitives
**Complexity**: basic **Domain**: domain-primitives
**Patterns**: [error-creation, validation] **Dependencies**: [DomainErrorOptions]

## Description

Shows how to create a MissingValueError with a specific value message and optional error options.

## Business Context

Used when validating required fields or properties and need to create a structured error with domain-specific information.

## Code Example

@extract: withValue:domain:basic
const error = MissingValueError.withValue('Username is required');
throw error;
@extract-end

@extract: withValue:service:basic
const validateUserData = (userData: UserData) => {
  if (!userData.username) {
    throw MissingValueError.withValue('Username is required', { domain: 'User' });
  }
  return userData;
};
@extract-end

@extract: withValue:integration:basic
const userService = new UserService();
try {
  await userService.createUser({ email: 'test@example.com' });
} catch (error) {
  if (error instanceof MissingValueError) {
    logger.error('User creation failed:', error.message);
    return { success: false, error: error.message };
  }
}
@extract-end

## Key Features

- Creates structured domain errors with specific messages
- Supports optional error data and domain context
- Integrates with domain error handling patterns

## Common Pitfalls

- Don't forget to include domain context in service/integration layers
- Always check error instance type when catching

## Related Examples

- [withParameter example](./withParameter.md)
- [withEntityId example](./withEntityId.md)