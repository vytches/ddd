# InvalidParameterError withParameter - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-primitives
**Complexity**: intermediate **Domain**: domain-primitives
**Patterns**: [parameter-validation, error-creation] **Dependencies**: [DomainErrorOptions]

## Description

Shows how to create an InvalidParameterError with parameter name and validation context.

## Business Context

Used for validating method parameters and providing detailed error information about which parameter failed validation.

## Code Example

@extract: withParameter:domain:intermediate
const error = InvalidParameterError.withParameter('email', 'Invalid email format');
throw error;
@extract-end

@extract: withParameter:service:intermediate
const validateEmailFormat = (email: string) => {
  if (!email.includes('@')) {
    const validationContext = { field: 'email', value: email, rule: 'format' };
    throw InvalidParameterError.withParameter('email', 'Must contain @ symbol', { data: validationContext });
  }
  return true;
};
@extract-end

@extract: withParameter:integration:advanced
const authService = new AuthenticationService();
try {
  await authService.login(username, password);
} catch (error) {
  if (error instanceof InvalidParameterError) {
    const response = { error: error.message, field: error.data?.field };
    return res.status(400).json(response);
  }
}
@extract-end

## Key Features

- Provides parameter-specific error messages
- Supports custom messages and domain context
- Standardizes validation error handling

## Common Pitfalls

- Always specify which parameter failed validation
- Include meaningful error messages for better debugging

## Related Examples

- [withValue example](./withValue.md)
- [withEntityId example](./withEntityId.md)