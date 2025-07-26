// Base value object classes and interfaces
export { BaseValueObject, type ValueObjectValidator } from './base-value-object';

// Entity identifier value objects
export { EntityId, EntityIdFactory } from './id.value-object';

// Re-export contracts types for convenience
export type { IEntityId, IEntityIdFactory, IdType } from '@vytches/ddd-contracts';
