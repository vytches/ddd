# BaseValueObject.equals() - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects  
**Complexity**: intermediate **Domain**: Core  
**Patterns**: Value Object, Equality **Dependencies**: None

## Description

Compares two value objects for equality using value-based comparison instead of reference equality.

## Business Context

Value objects must implement proper equality comparison to ensure business rules work correctly when comparing domain values like Money, Email, or Address.

@extract: equals:domain:basic
```typescript
// Compare two Email value objects
const email1 = new Email("user@example.com");
const email2 = new Email("user@example.com");
const isEqual = email1.equals(email2); // true
```
@extract-end

@extract: equals:service:intermediate
```typescript
// Service layer equality checking
const updateUserEmail = (user: User, newEmail: Email) => {
  if (!user.email.equals(newEmail)) {
    user.changeEmail(newEmail);
    return userRepository.save(user);
  }
  return user; // No change needed
};
```
@extract-end

@extract: equals:integration:advanced
```typescript
// Complex domain comparison in business rules
const validateAccountTransfer = (fromAccount: Account, toAccount: Account) => {
  if (fromAccount.currency.equals(toAccount.currency)) {
    return directTransfer(fromAccount, toAccount);
  }
  return currencyExchangeTransfer(fromAccount, toAccount);
};
```
@extract-end

## Key Features

- Value-based equality comparison instead of reference equality
- Null-safe comparison with proper handling of undefined/null values
- Works with any value object type extending BaseValueObject
- Essential for Domain-Driven Design value object semantics

## Common Pitfalls

- Don't use === for value object comparison - always use equals()
- Remember that equals() checks the internal value, not object references
- Null value objects will return false when compared with valid objects

## Related Examples

- [BaseValueObject.getValue()](./getValue.md) - Extract the underlying value
- [BaseValueObject.toString()](./toString.md) - String representation