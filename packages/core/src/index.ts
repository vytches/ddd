// Core aggregates - re-exported from aggregates package
// Test comment for lerna behavior
export { AggregateRoot, AggregateBuilder, AggregateError } from '@vytches/ddd-aggregates';

// Aggregate interfaces
export type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateBuilder,
  IAggregateConstructorParams,
} from '@vytches/ddd-aggregates';

// Value objects - re-exported from value-objects package
export { BaseValueObject } from '@vytches/ddd-value-objects';

export type { ValueObjectValidator } from '@vytches/ddd-value-objects';

// Entity IDs - re-exported from contracts (enterprise-level fundamental types)
export { EntityId } from '@vytches/ddd-contracts';
export type { IdType } from '@vytches/ddd-contracts';

// Errors - re-exported from domain-primitives
export {
  IDomainError,
  BaseError,
  InvalidParameterError,
  MissingValueError,
  DuplicateError,
  NotFoundError,
  DomainErrorCode,
  ApplicationErrorCode,
  FrameworkErrorCode,
} from '@vytches/ddd-domain-primitives';

export type { DomainErrorOptions } from '@vytches/ddd-domain-primitives';

// Repositories - re-exported from repositories package
export { IBaseRepository, VersionError } from '@vytches/ddd-repositories';
export type {
  IRepositoryAggregate,
  IRepository,
  IRepositoryProvider,
  IExtendedRepository,
  IUnitOfWork,
} from '@vytches/ddd-repositories';

// Actor - re-exported from domain-primitives
export type { IActor } from '@vytches/ddd-domain-primitives';
