# EntityId.fromText() - Advanced Example

**Version**: 1.0.0 **Package**: @vytches/ddd-value-objects  
**Complexity**: advanced **Domain**: Core  
**Patterns**: Factory Method, Legacy Integration **Dependencies**: @vytches/ddd-utils, @vytches/ddd-domain-primitives

## Description

Create EntityId from text string identifier with character validation for legacy system integration.

## Business Context

Text-based identifiers are common in legacy systems, product codes, and human-readable identifiers that need to be integrated into modern DDD systems.

@extract: fromText:domain:basic
```typescript
// Create EntityId from text identifier
const productCode = "PROD-001";
const productId = EntityId.fromText(productCode);
console.log(productId.getValue()); // "PROD-001"
console.log(productId.getType()); // "text"
```
@extract-end

@extract: fromText:service:intermediate
```typescript
// Service layer with text-based IDs
const findProductByCode = (code: string) => {
  const productId = EntityId.fromText(code); // Validates format
  return productRepository.findById(productId);
};
```
@extract-end

@extract: fromText:integration:advanced
```typescript
// Legacy system integration with text IDs
const integrateLegacySystem = async (legacyCode: string) => {
  const entityId = EntityId.fromText(legacyCode);
  
  const modernEntity = await modernService.findByLegacyId(entityId);
  return await migrationService.migrate(modernEntity);
};
```
@extract-end

## Key Features

- Validates text format using alphanumeric, underscore, and hyphen characters
- Throws MissingValueError for empty strings
- Throws InvalidParameterError for invalid characters
- Ideal for product codes, legacy IDs, and human-readable identifiers

## Common Pitfalls

- Text IDs only allow [a-zA-Z0-9_-] characters - validate input first
- Empty strings will throw errors - check for non-empty values
- Consider case sensitivity when comparing text-based EntityIds

## Related Examples

- [EntityId.createWithRandomUUID()](./createWithRandomUUID.md) - Generate UUID
- [EntityId.fromUUID()](./fromUUID.md) - Create from UUID string