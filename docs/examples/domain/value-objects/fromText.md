# EntityId fromText - Basic Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects
**Complexity**: basic **Domain**: value-objects
**Patterns**: [id-creation, text-validation] **Dependencies**: [LibUtils, MissingValueError]

## Description

Shows how to create an EntityId from a text string with validation for allowed characters.

## Business Context

Used for human-readable identifiers like usernames, product codes, or slug-based IDs.

## Code Example

@extract: fromText:domain:basic
```typescript
const entityId = EntityId.fromText('user-123');
const textValue = entityId.getValue();
```
@extract-end

@extract: fromText:service:basic
```typescript
const createProductCode = (productName: string) => {
  const code = productName.toLowerCase().replace(/\s+/g, '-');
  return EntityId.fromText(code);
};
```
@extract-end

@extract: fromText:integration:basic
```typescript
const productRepository = new ProductRepository();
try {
  const productId = EntityId.fromText(request.body.productCode);
  const product = await productRepository.findByCode(productId);
  return response.json(product);
} catch (error) {
  return response.status(400).json({ error: 'Invalid product code format' });
}
```
@extract-end

## Key Features

- Validates text contains only alphanumeric characters, underscores, and hyphens
- Provides clear error messages for invalid characters
- Supports human-readable identifier patterns

## Common Pitfalls

- Text IDs cannot contain spaces or special characters
- Always validate input before creating text-based EntityIds

## Related Examples

- [createWithRandomUUID example](./createWithRandomUUID.md)
- [fromUUID example](./fromUUID.md)