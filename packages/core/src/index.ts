// Core aggregates - most commonly used
export {
  AggregateRoot,
  AggregateBuilder,
  AggregateTestBuilder
} from './aggregates';

// Aggregate interfaces
export type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateBuilder
} from './aggregates';

// Value objects
export {
  BaseValueObject,
  EntityId
} from './value-objects';

// Errors
export {
  IDomainError,
  BaseError
} from './errors';

export type {
  DomainErrorOptions
} from './errors';

// Error codes
export {
  DomainErrorCode,
  ApplicationErrorCode,
  FrameworkErrorCode
} from './errors/error.enum';

// Repositories
export {
  IBaseRepository
} from './repositories';
export type { 
  IUnitOfWork,
  IRepository 
} from './repositories';

// Actor
export type {
  IActor
} from './actor';

// For advanced usage - import from specific subpaths
// e.g., import { IAggregateCapability } from '@vytches-ddd/core/aggregates'
// Note: Full exports removed for better tree-shaking
