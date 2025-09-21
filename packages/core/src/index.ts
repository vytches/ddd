// Core aggregates - re-exported from aggregates package
// Test comment for lerna behavior
export { AggregateBuilder, AggregateError, AggregateRoot } from '@vytches/ddd-aggregates';

// Aggregate interfaces
export type {
  IAggregateBuilder,
  IAggregateCapability,
  IAggregateConstructorParams,
  IAggregateRoot,
} from '@vytches/ddd-aggregates';

// Value objects - re-exported from value-objects package
export { BaseValueObject } from '@vytches/ddd-value-objects';

export type { ValueObjectValidator } from '@vytches/ddd-value-objects';

// Entity IDs - re-exported from contracts (enterprise-level fundamental types)
export { EntityId } from '@vytches/ddd-contracts';
export type { IdType } from '@vytches/ddd-contracts';

// Errors - re-exported from domain-primitives
export {
  ApplicationErrorCode,
  BaseError,
  DomainErrorCode,
  DuplicateError,
  FrameworkErrorCode,
  IDomainError,
  InvalidParameterError,
  MissingValueError,
  NotFoundError,
} from '@vytches/ddd-domain-primitives';

export type { DomainErrorOptions } from '@vytches/ddd-domain-primitives';

// Actor - re-exported from domain-primitives
export type { IActor } from '@vytches/ddd-domain-primitives';

// NOTE: Repositories and Process Managers removed from core to prevent circular dependencies
// Import directly from @vytches/ddd-repositories and @vytches/ddd-process-managers in your application
