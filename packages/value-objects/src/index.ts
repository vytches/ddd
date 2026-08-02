// Base value object classes and interfaces
export { BaseValueObject, type ValueObjectValidator } from './base-value-object';

// Entity identifier value objects
// EntityIdFactory removed (VF-024, AC3) — deprecated wrapper class dropped
// pre-1.0 instead of shipped as deprecated on day one. Use EntityId's static
// factory methods directly. See CHANGELOG.md.
export { EntityId } from './id.value-object';

// Branded ID types for compile-time safety
export type { BrandedId } from './branded-id';
export { createBrandedId, newBrandedId, brandedIdFromUUID, brandedIdFromText } from './branded-id';

// Re-export contracts types for convenience
export type { IEntityId, IEntityIdFactory, IdType } from '@vytches/ddd-contracts';
