// Core aggregates - re-exported from aggregates package
export {
  AggregateRoot,
  AggregateBuilder,
  AggregateTestBuilder,
  AggregateError
} from '@vytches-ddd/aggregates';

// Aggregate interfaces
export type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateBuilder
} from '@vytches-ddd/aggregates';

// Value objects - re-exported from value-objects package
export {
  BaseValueObject,
  EntityId
} from '@vytches-ddd/value-objects';

export type {
  ValueObjectValidator,
  IdType
} from '@vytches-ddd/value-objects';

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
  FrameworkErrorCode
} from '@vytches-ddd/domain-primitives';

export type {
  DomainErrorOptions
} from '@vytches-ddd/domain-primitives';

// Repositories - re-exported from repositories package
export {
  IBaseRepository,
  VersionError
} from '@vytches-ddd/repositories';
export type {
  IRepositoryAggregate,
  IRepository,
  IRepositoryProvider,
  IExtendedRepository,
  IUnitOfWork
} from '@vytches-ddd/repositories';

// Actor - re-exported from domain-primitives
export type {
  IActor
} from '@vytches-ddd/domain-primitives';

// For advanced usage - import from specific subpaths
// e.g., import { IAggregateCapability } from '@vytches-ddd/core/aggregates'
// Note: Full exports removed for better tree-shaking
