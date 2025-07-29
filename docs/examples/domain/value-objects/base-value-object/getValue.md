# BaseValueObject.getValue() - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects  
**Complexity**: basic **Domain**: Core  
**Patterns**: Value Object, Accessor **Dependencies**: None

## Description

Returns the internal value of a value object for use in business logic and data persistence.

## Business Context

Extracting the underlying value from value objects is essential for persistence, API responses, and integration with external systems.

@extract: getValue:domain:basic
```typescript
// Extract value from value object
const email = new Email("user@example.com");
const emailString = email.getValue(); // "user@example.com"
console.log(emailString);
```
@extract-end

@extract: getValue:service:intermediate
```typescript
// Service layer value extraction
const sendWelcomeEmail = (user: User) => {
  const emailAddress = user.email.getValue();
  return emailService.send(emailAddress, 'Welcome!');
};
```
@extract-end

@extract: getValue:integration:advanced
```typescript
// API response serialization
const getUserProfile = (user: User) => {
  return {
    id: user.id.getValue(),
    email: user.email.getValue(),
    createdAt: user.createdAt.getValue(),
    profile: user.profile.toJSON()
  };
};
```
@extract-end

## Key Features

- Direct access to the internal value without wrapper overhead
- Type-safe value extraction preserving the original type
- Essential for persistence and external system integration
- Compatible with any value object extending BaseValueObject

## Common Pitfalls

- Don't modify the returned value - value objects should be immutable
- Use getValue() for data persistence, not for business logic comparisons
- Remember that getValue() returns the raw value, not a copy

## Related Examples

- [BaseValueObject.equals()](./equals.md) - Compare value objects properly
- [BaseValueObject.toString()](./toString.md) - String representation