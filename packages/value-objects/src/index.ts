// Base value object classes and interfaces
export { BaseValueObject, type ValueObjectValidator } from './base-value-object';

// Entity identifier value objects
export { EntityId, EntityIdFactory } from './id.value-object';

// Branded ID types for compile-time safety
export type { BrandedId } from './branded-id';
export { createBrandedId, newBrandedId, brandedIdFromUUID, brandedIdFromText } from './branded-id';

// Re-export contracts types for convenience
export type { IEntityId, IEntityIdFactory, IdType } from '@vytches/ddd-contracts';
